import os
import sqlite3
from pathlib import Path
from secrets import compare_digest
import csv


from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware


# =========================
# НАСТРОЙКИ
# =========================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

DB_DIR = BASE_DIR / "data"
ARCHIVE_DIR = DB_DIR / "archive"
DB_PATH = DB_DIR / "quest.db"

FRONTEND_DIR = PROJECT_DIR / "frontend"

load_dotenv(PROJECT_DIR / ".env")

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
SESSION_SECRET = os.getenv("SESSION_SECRET")

if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD не указан в .env")

if not SESSION_SECRET:
    raise RuntimeError("SESSION_SECRET не указан в .env")


app = FastAPI()

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site="lax",
    https_only=False
)

@app.middleware("http")
async def disable_cache(request: Request, call_next):
    response = await call_next(request)

    path = request.url.path

    if (
        path == "/"
        or path.endswith(".html")
        or path.endswith(".js")
        or path.endswith(".css")
    ):
        response.headers["Cache-Control"] = (
            "no-store, no-cache, must-revalidate, max-age=0"
        )

        response.headers["Pragma"] = "no-cache"

    return response


# =========================
# ФАКТОРЫ ДЛЯ УЧАСТНИКОВ
# =========================

FACTORS = [
    {
        "id": 1,
        "text": "Нарушение условий хранения: неисправность вентиляции, загрязнение воздуха или наличие химических раздражителей."
    },
    {
        "id": 2,
        "text": "Нарушения в работе охранно-пожарной сигнализации: отсутствие проверки, просроченная поверка или неисправность системы."
    },
    {
        "id": 3,
        "text": "Наличие среди руководства лица, заинтересованного в страховом случае и имеющего возможность повлиять на происходящее."
    },
    {
        "id": 4,
        "text": "Отсутствие актуального учёта экспонатов или расхождения в инвентаризационных документах."
    },
    {
        "id": 5,
        "text": "Наличие рядом с экспонатом постороннего электронного или радиопередающего устройства, способного влиять на оборудование."
    },
    {
        "id": 6,
        "text": "Недостаточная защита витрины или её несоответствие требованиям безопасности экспоната."
    },
    {
        "id": 7,
        "text": "Признаки намеренного вмешательства в электроснабжение, освещение или электрощиток, которое могло создать уязвимость."
    },
    {
        "id": 8,
        "text": "Неучтённые биологические или химические следы рядом с экспонатом."
    },
    {
        "id": 9,
        "text": "Нарушение правил допуска посторонних лиц или подрядчиков в служебные помещения и к экспонатам."
    },
    {
        "id": 10,
        "text": "Санкционированный доступ к объекту с последующей подменой."
    },
    {
        "id": 11,
        "text": "Отсутствие тревожной сигнализации на посту охраны."
    },
    {
        "id": 12,
        "text": "Ранее наступивший инцидент с человеком на объекте."
    },
    {
        "id": 13,
        "text": "Повреждения витрины или её конструкций: коррозия, плесень, биологическое поражение и другие признаки разрушения."
    },
    {
        "id": 14,
        "text": "Сокрытие следов и воздействие на свидетеля."
    },
    {
        "id": 15,
        "text": "Нарушение режима освещения экспоната: чрезмерно яркий свет или воздействие ультрафиолета."
    },
    {
        "id": 16,
        "text": "Отсутствие необходимых документов на передачу экспоната другому лицу или организации на ответственное хранение."
    },
    {
        "id": 17,
        "text": "Отсутствие действующего разрешения или лицензии, необходимой для экспонирования объекта."
    }
]

INSURANCE_SUM = 20_000_000

PARTICIPANT_RULES = (
    f"Полная страховая стоимость экспоната — {INSURANCE_SUM} руб. "
    "Ниже приведён перечень факторов, каждый из которых потенциально "
    "снижает выплату. Кратко обоснуйте те факторы, которые вы можете "
    "подтвердить найденными уликами и показаниями сотрудников. "
    "Неподтверждённые и голословные факторы не учитываются. "
    "Не каждый пункт списка применим к данному музею — это стандартная "
    "ведомость, и часть факторов может не подтвердиться. "
    "Ваша выгода — обосновать как можно больше применимых факторов."
)


# =========================
# НАСТОЯЩИЕ ФАКТОРЫ
# Только они видны админу
# =========================

REAL_FACTORS = {
    1: {
        "factor": FACTORS[0]["text"],
        "block": "A",
        "criterion": "Назван «плохой воздух/вентиляция» + ≥1 улика.",
        "hint": (
            "Неисправная вентиляция / химраздражитель. "
            "Подходят жалоба бухгалтера, документы об увольнениях, "
            "колбы/схема вентиляции, жалобы директрисы."
        )
    },

    3: {
        "factor": FACTORS[2]["text"],
        "block": "B",
        "person": "Директриса",
        "criterion": "Названа директриса как инициатор + ≥1 улика.",
        "hint": (
            "Пустой ежедневник на 2 октября, обведённый случай "
            "в правилах страховки, связи с другими фигурантами."
        )
    },

    5: {
        "factor": FACTORS[4]["text"],
        "block": "A",
        "criterion": (
            "Названо постороннее устройство/передатчик "
            "+ предъявлена улика."
        ),
        "hint": (
            "Передатчик в кармане Эдика, странное поведение радио, "
            "чертёж/инструкция."
        )
    },

    7: {
        "factor": FACTORS[6]["text"],
        "block": "B",
        "person": "Кураторша",
        "criterion": (
            "Названа кураторша + связь «щиток → свет» "
            "+ улика/показания."
        ),
        "hint": (
            "Пособие по проводке, кислотная изолента, "
            "розовая изолента в щитке, часы на 20:20."
        )
    },

    8: {
        "factor": FACTORS[7]["text"],
        "block": "A",
        "criterion": (
            "Названы следы у экспоната + этикетка/бутылёк "
            "или показания."
        ),
        "hint": (
            "Пепел и кровь у зеркала, этикетка искусственной крови, "
            "бутылёк, показания уборщицы."
        )
    },

    10: {
        "factor": FACTORS[9]["text"],
        "block": "B",
        "person": "Реставраторша",
        "criterion": (
            "Названа реставраторша + вынос/подмена + ≥1 улика."
        ),
        "hint": (
            "Журнал реставраций без гримуара, чёрные перчатки, "
            "фонарик, второй куб, краски, показания физика."
        )
    },

    12: {
        "factor": FACTORS[11]["text"],
        "block": "A",
        "criterion": (
            "Названа смерть/ЧП + копия дела или фото "
            "или газета/показания."
        ),
        "hint": (
            "Смерть прошлого уборщика: копия дела, чёрно-белое фото, "
            "газеты, отзывы, показания смотрителя."
        )
    },

    14: {
        "factor": FACTORS[13]["text"],
        "block": "B",
        "person": "Инженер",
        "criterion": (
            "Назван инженер + сокрытие следов/давление на охрану "
            "+ улика."
        ),
        "hint": (
            "Инженер трогал щиток, требовал стереть записи, "
            "подмена флешек, ожог инженера, следы у охранника."
        )
    }
}


BLOCK_A_IDS = {1, 5, 8, 12}
BLOCK_B_IDS = {3, 7, 10, 14}


# =========================
# PYDANTIC
# =========================

class Answer(BaseModel):
    questionId: int
    question: str
    answer: str = ""


class Submission(BaseModel):
    teamName: str
    answers: list[Answer]


class LoginRequest(BaseModel):
    password: str


class ReviewRequest(BaseModel):
    status: str


# =========================
# SQLITE
# =========================

def get_connection():
    connection = sqlite3.connect(DB_PATH)

    connection.row_factory = sqlite3.Row

    connection.execute(
        "PRAGMA foreign_keys = ON"
    )

    return connection


def column_exists(connection, table_name, column_name):
    columns = connection.execute(
        f"PRAGMA table_info({table_name})"
    ).fetchall()

    return any(
        column["name"] == column_name
        for column in columns
    )


def init_db():
    DB_DIR.mkdir(exist_ok=True)
    ARCHIVE_DIR.mkdir(exist_ok=True)

    connection = get_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_name TEXT NOT NULL,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            submission_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL DEFAULT '',

            FOREIGN KEY (submission_id)
                REFERENCES submissions(id)
                ON DELETE CASCADE
        )
    """)

    # Миграция старой базы
    if not column_exists(
        connection,
        "answers",
        "review_status"
    ):
        connection.execute("""
            ALTER TABLE answers
            ADD COLUMN review_status TEXT
            NOT NULL DEFAULT 'unreviewed'
        """)

    if not column_exists(
        connection,
        "answers",
        "reviewed_at"
    ):
        connection.execute("""
            ALTER TABLE answers
            ADD COLUMN reviewed_at DATETIME
        """)

    # Запрещаем одинаковые названия компаний
    try:
        connection.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS
            idx_unique_team_name
            ON submissions(team_name COLLATE NOCASE)
        """)
    except sqlite3.IntegrityError:
        print(
            "В базе уже есть несколько компаний "
            "с одинаковым названием."
        )

    connection.commit()
    connection.close()


init_db()


# =========================
# АВТОРИЗАЦИЯ АДМИНА
# =========================

def require_admin(request: Request):
    if not request.session.get("admin"):
        raise HTTPException(
            status_code=401,
            detail="Требуется авторизация администратора"
        )


@app.post("/api/admin/login")
def admin_login(
    data: LoginRequest,
    request: Request
):
    if not compare_digest(
        data.password,
        ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверный пароль"
        )

    request.session["admin"] = True

    return {
        "success": True
    }


@app.post("/api/admin/logout")
def admin_logout(request: Request):
    request.session.clear()

    return {
        "success": True
    }


@app.get("/api/admin/me")
def admin_me(request: Request):
    return {
        "authenticated":
            bool(request.session.get("admin"))
    }


# =========================
# ПУБЛИЧНЫЕ ФАКТОРЫ
# =========================

@app.get("/api/factors")
def get_factors():
    return {
        "rules": PARTICIPANT_RULES,
        "factors": FACTORS
    }

class CompanyCheckRequest(BaseModel):
    companyName: str


@app.post("/api/company/check")
def check_company(data: CompanyCheckRequest):
    company_name = data.companyName.strip()

    if not company_name:
        raise HTTPException(
            status_code=400,
            detail="Название компании не указано"
        )

    connection = get_connection()

    existing = connection.execute(
        """
        SELECT id
        FROM submissions
        WHERE team_name = ? COLLATE NOCASE
        """,
        (company_name,)
    ).fetchone()

    connection.close()

    return {
        "available": existing is None
    }

# =========================
# ОТПРАВКА ВЕДОМОСТИ
# =========================

@app.post("/api/answers")
def save_answers(submission: Submission):
    team_name = submission.teamName.strip()

    if not team_name:
        raise HTTPException(
            status_code=400,
            detail="Название компании не указано"
        )

    connection = get_connection()

    existing = connection.execute(
        """
        SELECT id
        FROM submissions
        WHERE team_name = ? COLLATE NOCASE
        """,
        (team_name,)
    ).fetchone()

    if existing:
        connection.close()

        raise HTTPException(
            status_code=409,
            detail=(
                "Компания с таким названием "
                "уже отправила ведомость"
            )
        )

    try:
        cursor = connection.execute(
            """
            INSERT INTO submissions (team_name)
            VALUES (?)
            """,
            (team_name,)
        )

        submission_id = cursor.lastrowid

        submitted_answers = {
            item.questionId: item
            for item in submission.answers
        }

        # Сохраняем все 17 факторов,
        # даже если пользователь оставил поле пустым
        for factor in FACTORS:
            question_id = factor["id"]

            submitted = submitted_answers.get(
                question_id
            )

            answer_text = ""

            if submitted:
                answer_text = submitted.answer.strip()

            connection.execute(
                """
                INSERT INTO answers (
                    submission_id,
                    question_id,
                    question,
                    answer,
                    review_status
                )
                VALUES (?, ?, ?, ?, 'unreviewed')
                """,
                (
                    submission_id,
                    question_id,
                    factor["text"],
                    answer_text
                )
            )

        connection.commit()

    except sqlite3.IntegrityError:
        connection.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Компания с таким названием "
                "уже отправила ведомость"
            )
        )

    finally:
        connection.close()

    return {
        "success": True,
        "submissionId": submission_id
    }


# =========================
# ПОДСЧЁТ РЕЗУЛЬТАТА
# =========================

def calculate_score(answers):
    status_by_id = {
        row["question_id"]: row["review_status"]
        for row in answers
    }

    def get_weight(question_id):
        status = status_by_id.get(
            question_id,
            "unreviewed"
        )

        if status == "correct":
            return 1.0

        if status == "partial":
            return 0.5

        return 0.0

    # =========================
    # БЛОК A
    # correct = 5%
    # partial = 2.5%
    # =========================

    block_a_count = sum(
        get_weight(question_id)
        for question_id in BLOCK_A_IDS
    )

    block_a_reduction = min(
        block_a_count * 0.05,
        0.20
    )

    # =========================
    # БЛОК B
    # correct = 25%
    # partial = 12.5%
    # =========================

    block_b_count = sum(
        get_weight(question_id)
        for question_id in BLOCK_B_IDS
    )

    # Все 4 фигуранта должны быть именно полностью верными
    full_conspiracy = all(
        status_by_id.get(question_id) == "correct"
        for question_id in BLOCK_B_IDS
    )

    if full_conspiracy:
        return {
            "blockACount": block_a_count,
            "blockAPercent":
                round(block_a_reduction * 100, 1),

            "personsCount": 4,
            "blockBPercent": 100,

            "totalReductionPercent": 100,
            "payout": 0,

            "fullConspiracy": True
        }

    block_b_reduction = (
        block_b_count * 0.25
    )

    # Если нет полной четвёрки,
    # итоговое снижение максимум 95%
    total_reduction = min(
        block_a_reduction + block_b_reduction,
        0.95
    )

    payout = (
        INSURANCE_SUM *
        (1 - total_reduction)
    )

    return {
        "blockACount": block_a_count,
        "blockAPercent":
            round(block_a_reduction * 100, 1),

        "personsCount": block_b_count,
        "blockBPercent":
            round(block_b_reduction * 100, 1),

        "totalReductionPercent":
            round(total_reduction * 100, 1),

        "payout":
            round(payout, 2),

        "fullConspiracy": False
    }



# =========================
# ДАННЫЕ АДМИНКИ
# =========================

@app.get("/api/admin/submissions")
def get_admin_submissions(request: Request):
    require_admin(request)

    connection = get_connection()

    submissions = connection.execute(
        """
        SELECT *
        FROM submissions
        ORDER BY submitted_at ASC
        """
    ).fetchall()

    result = []

    for submission in submissions:
        answers = connection.execute(
            """
            SELECT
                question_id,
                question,
                answer,
                review_status
            FROM answers
            WHERE submission_id = ?
            ORDER BY question_id
            """,
            (submission["id"],)
        ).fetchall()

        answered_count = sum(
            1
            for answer in answers
            if answer["answer"].strip()
        )

        real_answers = []

        for answer in answers:
            question_id = answer["question_id"]

            if question_id not in REAL_FACTORS:
                continue

            config = REAL_FACTORS[question_id]

            real_answers.append({
                "questionId": question_id,

                "factor":
                    config["factor"],

                "block":
                    config["block"],

                "person":
                    config.get("person"),

                "answer":
                    answer["answer"],

                "status":
                    answer["review_status"],

                "criterion":
                    config["criterion"],

                "hint":
                    config["hint"]
            })

        review_count = sum(
            1
            for answer in real_answers
            if answer["status"] != "unreviewed"
        )

        result.append({
    "id": submission["id"],

    "companyName":
        submission["team_name"],

    "submittedAt":
        submission["submitted_at"],

    "answeredCount":
        answered_count,

    "reviewedCount":
        review_count,

    "fullyReviewed":
        review_count == 8,

    "answers":
        real_answers,

    "score":
        calculate_score(answers)
})

    connection.close()

    # Меньшая выплата выше в таблице.
    # Победителя автоматически не выбираем.
    result.sort(
        key=lambda item: item["score"]["payout"]
    )

    return result


# =========================
# ПРОВЕРКА ОТВЕТА
# =========================

@app.patch(
    "/api/admin/submissions/"
    "{submission_id}/answers/{question_id}"
)
def review_answer(
    submission_id: int,
    question_id: int,
    data: ReviewRequest,
    request: Request
):
    require_admin(request)

    allowed_statuses = {
        "unreviewed",
        "correct",
        "partial",
        "incorrect"
    }

    if data.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Некорректный статус"
        )

    if question_id not in REAL_FACTORS:
        raise HTTPException(
            status_code=400,
            detail="Этот фактор не проверяется"
        )

    connection = get_connection()

    answer = connection.execute(
        """
        SELECT id
        FROM answers
        WHERE submission_id = ?
        AND question_id = ?
        """,
        (
            submission_id,
            question_id
        )
    ).fetchone()

    if not answer:
        connection.close()

        raise HTTPException(
            status_code=404,
            detail="Ответ не найден"
        )

    connection.execute(
        """
        UPDATE answers
        SET
            review_status = ?,
            reviewed_at = CURRENT_TIMESTAMP
        WHERE submission_id = ?
        AND question_id = ?
        """,
        (
            data.status,
            submission_id,
            question_id
        )
    )

    connection.commit()

    answers = connection.execute(
        """
        SELECT question_id, review_status
        FROM answers
        WHERE submission_id = ?
        """,
        (submission_id,)
    ).fetchall()

    score = calculate_score(answers)

    connection.close()

    return {
        "success": True,
        "score": score
    }


# =========================
# СТРАНИЦА АДМИНА
# =========================

@app.get("/admin")
@app.get("/admin.html")
def admin_page(request: Request):
    if not request.session.get("admin"):
        return RedirectResponse(
            "/admin-login.html"
        )

    return FileResponse(
        FRONTEND_DIR / "admin.html"
    )


def create_archive_csv(submissions, connection, prefix="flow"):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

    filename = f"{prefix}_{timestamp}.csv"
    archive_path = ARCHIVE_DIR / filename

    with open(
        archive_path,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as file:

        writer = csv.writer(
            file,
            delimiter=";"
        )

        writer.writerow([
            "ID отправки",
            "Компания",
            "Время отправки",
            "Номер фактора",
            "Фактор",
            "Ответ",
            "Учитывается в расчёте",
            "Блок",
            "Фигурант",
            "Статус проверки",
            "Снижение, %",
            "Выплата"
        ])

        for submission in submissions:

            answers = connection.execute(
                """
                SELECT
                    question_id,
                    question,
                    answer,
                    review_status
                FROM answers
                WHERE submission_id = ?
                ORDER BY question_id
                """,
                (submission["id"],)
            ).fetchall()

            score = calculate_score(answers)

            for answer in answers:

                question_id = answer["question_id"]

                real_factor = REAL_FACTORS.get(question_id)

                writer.writerow([
                    submission["id"],
                    submission["team_name"],
                    submission["submitted_at"],
                    question_id,
                    answer["question"],
                    answer["answer"],
                    "Да" if real_factor else "Нет",
                    real_factor["block"]
                        if real_factor else "",
                    real_factor.get("person", "")
                        if real_factor else "",
                    answer["review_status"],
                    score["totalReductionPercent"],
                    score["payout"]
                ])

    return archive_path

@app.post("/api/admin/archive-all")
def archive_all_submissions(request: Request):
    require_admin(request)

    connection = get_connection()

    submissions = connection.execute(
        """
        SELECT *
        FROM submissions
        ORDER BY submitted_at ASC
        """
    ).fetchall()

    if not submissions:
        connection.close()

        raise HTTPException(
            status_code=400,
            detail="Нет ведомостей для архивирования"
        )

    try:
        # Сначала создаём CSV.
        # Если создание не получилось —
        # из базы ничего не удаляем.
        archive_path = create_archive_csv(
            submissions,
            connection,
            prefix="flow"
        )

        # Сначала дочерняя таблица.
        connection.execute(
            "DELETE FROM answers"
        )

        # Потом submissions.
        connection.execute(
            "DELETE FROM submissions"
        )

        connection.commit()

    except Exception:
        connection.rollback()
        connection.close()
        raise

    connection.close()

    return FileResponse(
        archive_path,
        media_type="text/csv",
        filename=archive_path.name
    )

# =========================
# STATIC FRONTEND
# ОБЯЗАТЕЛЬНО САМОЕ ПОСЛЕДНЕЕ
# =========================

app.mount(
    "/",
    StaticFiles(
        directory=FRONTEND_DIR,
        html=True
    ),
    name="frontend"
)