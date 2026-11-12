// =========================
// ЭЛЕМЕНТЫ
// =========================

const submissionsContainer =
    document.querySelector("#submissions-container");

const submissionsCount =
    document.querySelector("#submissions-count");

const resultsTableBody =
    document.querySelector("#results-table-body");

const refreshButton =
    document.querySelector("#refresh-button");

const logoutButton =
    document.querySelector("#logout-button");

const archiveAllButton =
    document.querySelector("#archive-all-button");

const lastUpdate =
    document.querySelector("#last-update");

    const adminBackgrounds = [
    "/images/pic1.jpg",
    "/images/pic2.jpg",
    "/images/pic3.jpg",
    "/images/pic4.jpg"
];

const randomBackground =
    adminBackgrounds[
        Math.floor(
            Math.random() * adminBackgrounds.length
        )
    ];

document.body.style.backgroundImage =
    `url("${randomBackground}")`;


// =========================
// СОСТОЯНИЕ КАРТОЧЕК
// =========================

// Храним:
// submissionId -> true / false
//
// true  = карточка раскрыта
// false = карточка свёрнута

const companyOpenState = new Map();


// =========================
// ЗАГРУЗКА ДАННЫХ
// =========================

async function loadSubmissions() {

    // Перед перерисовкой запоминаем,
    // что пользователь свернул/раскрыл.
    rememberOpenStates();


    try {

        const response =
            await fetch("/api/admin/submissions");


        if (response.status === 401) {

            window.location.href =
                "/admin-login.html";

            return;
        }


        if (!response.ok) {

            const message =
                await getErrorMessage(
                    response,
                    "Не удалось получить ведомости"
                );

            throw new Error(message);

        }


        const submissions =
            await response.json();


        renderResultsTable(submissions);

        renderSubmissions(submissions);


        submissionsCount.textContent =
            submissions.length;


        const now =
            new Date();


        lastUpdate.textContent =
            `Обновлено: ${now.toLocaleTimeString("ru-RU")}`;

    }

    catch (error) {

        console.error(
            "Ошибка загрузки ведомостей:",
            error
        );


        submissionsContainer.innerHTML = `
            <p class="error-message">
                Не удалось загрузить ведомости.
            </p>
        `;

    }
}


// =========================
// ЗАПОМИНАЕМ OPEN / CLOSED
// =========================

function rememberOpenStates() {

    document
        .querySelectorAll(
            ".admin-submission-card"
        )
        .forEach((card) => {

            const submissionId =
                card.dataset.submissionId;


            if (!submissionId) {
                return;
            }


            companyOpenState.set(
                String(submissionId),
                card.open
            );

        });
}


// =========================
// ОБЩАЯ ТАБЛИЦА
// =========================

function renderResultsTable(submissions) {

    resultsTableBody.innerHTML = "";


    if (submissions.length === 0) {

        resultsTableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-empty"
                >
                    Пока нет результатов
                </td>
            </tr>
        `;

        return;
    }


    submissions.forEach((submission) => {

        const row =
            document.createElement("tr");


        const score =
            submission.score;


        row.innerHTML = `
            <td class="company-cell">
                ${escapeHtml(
                    submission.companyName
                )}
            </td>

            <td>
                ${submission.answeredCount ?? 0}/17
            </td>

            <td>
                ${score.blockAPercent}%

                <span class="table-secondary">
                    (${score.blockACount}/4)
                </span>
            </td>

            <td>
                ${score.personsCount}/4
            </td>

            <td>
                ${score.totalReductionPercent}%
            </td>

            <td class="payout-cell">
                ${formatMoney(score.payout)}
            </td>

            <td>
                <span class="
                    review-progress
                    ${submission.fullyReviewed
                        ? "review-progress-complete"
                        : ""}
                ">
                    ${submission.reviewedCount}/8
                </span>
            </td>
        `;


        resultsTableBody.appendChild(row);

    });
}


// =========================
// КАРТОЧКИ КОМПАНИЙ
// =========================

function renderSubmissions(submissions) {

    submissionsContainer.innerHTML = "";


    if (submissions.length === 0) {

        submissionsContainer.innerHTML = `
            <p class="empty-message">
                Пока никто не отправил ведомость.
            </p>
        `;

        return;
    }


    submissions.forEach((submission) => {

        const card =
            document.createElement("details");


        card.classList.add(
            "admin-submission-card"
        );


        card.dataset.submissionId =
            String(submission.id);


        // Проверяем, есть ли уже сохранённое
        // состояние этой карточки.
        const savedState =
            companyOpenState.get(
                String(submission.id)
            );


        if (savedState !== undefined) {

            card.open = savedState;

        } else {

            // Новые непроверенные компании
            // по умолчанию раскрыты.
            //
            // Полностью проверенные —
            // по умолчанию свёрнуты.
            card.open =
                !submission.fullyReviewed;

        }


        const score =
            submission.score;


        const answersHtml =
            submission.answers
                .map((answer) =>
                    createAnswerHtml(
                        submission.id,
                        answer
                    )
                )
                .join("");


        card.innerHTML = `

            <summary class="admin-submission-header">

                <div>

                    <p class="small-text">
                        Компания-оценщик
                    </p>

                    <h2>
                        ${escapeHtml(
                            submission.companyName
                        )}
                    </h2>

                    <p class="submission-date">
                        ${formatDate(
                            submission.submittedAt
                        )}
                    </p>

                </div>


                <div class="submission-score">

                    <div>
                        <span>
                            Ответов
                        </span>

                        <strong>
                            ${submission.answeredCount ?? 0}/17
                        </strong>
                    </div>


                    <div>
                        <span>
                            Проверено
                        </span>

                        <strong>
                            ${submission.reviewedCount}/8
                        </strong>
                    </div>


                    <div>
                        <span>
                            Снижение
                        </span>

                        <strong>
                            ${score.totalReductionPercent}%
                        </strong>
                    </div>


                    <div>
                        <span>
                            Выплата
                        </span>

                        <strong>
                            ${formatMoney(
                                score.payout
                            )}
                        </strong>
                    </div>

                </div>

            </summary>


            <div class="factors-list">
                ${answersHtml}
            </div>

        `;


        submissionsContainer.appendChild(
            card
        );


        // Когда пользователь вручную
        // сворачивает/раскрывает карточку,
        // сразу запоминаем это.
        card.addEventListener(
            "toggle",
            () => {

                companyOpenState.set(
                    String(submission.id),
                    card.open
                );

            }
        );

    });


    addReviewButtonListeners();
}


// =========================
// ОДИН ФАКТОР
// =========================

function createAnswerHtml(
    submissionId,
    answer
) {

    const rawAnswer =
        answer.answer ?? "";


    const answerText =
        rawAnswer.trim()
            ? escapeHtml(rawAnswer)
            : `
                <span class="no-answer">
                    Нет ответа
                </span>
            `;


    const personHtml =
        answer.person
            ? `
                <span class="person-badge">
                    ${escapeHtml(
                        answer.person
                    )}
                </span>
            `
            : "";


    return `

        <section class="
            factor-review
            factor-status-${answer.status}
        ">

            <div class="factor-review-header">

                <div>

                    <div class="factor-meta">

                        <span class="factor-number">
                            ${String(
                                answer.questionId
                            ).padStart(2, "0")}
                        </span>

                        <span class="
                            block-badge
                            block-${answer.block.toLowerCase()}
                        ">
                            Блок ${answer.block}
                        </span>

                        ${personHtml}

                    </div>


                    <h3>
                        ${escapeHtml(
                            answer.factor
                        )}
                    </h3>

                </div>


                <span class="
                    status-label
                    status-${answer.status}
                ">
                    ${getStatusText(
                        answer.status
                    )}
                </span>

            </div>


            <div class="factor-answer">

                <p class="factor-label">
                    Ответ компании
                </p>

                <div class="factor-answer-text">
                    ${answerText}
                </div>

            </div>


            <div class="organizer-reference">

                <div>

                    <p class="factor-label">
                        Критерий зачёта
                    </p>

                    <p>
                        ${escapeHtml(
                            answer.criterion
                        )}
                    </p>

                </div>


                <div>

                    <p class="factor-label">
                        Подсказка организатору
                    </p>

                    <p>
                        ${escapeHtml(
                            answer.hint
                        )}
                    </p>

                </div>

            </div>


            <div class="review-buttons">

                <button
                    type="button"

                    class="
                        review-button
                        review-unreviewed
                        ${answer.status === "unreviewed"
                            ? "review-button-active"
                            : ""}
                    "

                    data-submission-id="${submissionId}"
                    data-question-id="${answer.questionId}"
                    data-status="unreviewed"
                >
                    Не проверено
                </button>


                <button
                    type="button"

                    class="
                        review-button
                        review-correct
                        ${answer.status === "correct"
                            ? "review-button-active"
                            : ""}
                    "

                    data-submission-id="${submissionId}"
                    data-question-id="${answer.questionId}"
                    data-status="correct"
                >
                    Верно
                </button>

                <button
                    type="button"
                    class="
                        review-button
                        review-partial
                        ${answer.status === "partial"
                            ? "review-button-active"
                            : ""}
                    "
                    data-submission-id="${submissionId}"
                    data-question-id="${answer.questionId}"
                    data-status="partial"
                >
                    50/50
                </button>


                <button
                    type="button"

                    class="
                        review-button
                        review-incorrect
                        ${answer.status === "incorrect"
                            ? "review-button-active"
                            : ""}
                    "

                    data-submission-id="${submissionId}"
                    data-question-id="${answer.questionId}"
                    data-status="incorrect"
                >
                    Неверно
                </button>

            </div>

        </section>
    `;
}


// =========================
// КНОПКИ ПРОВЕРКИ
// =========================

function addReviewButtonListeners() {

    const buttons =
        document.querySelectorAll(
            ".review-button"
        );


    buttons.forEach((button) => {

        button.addEventListener(
            "click",
            async () => {

                const submissionId =
                    button.dataset.submissionId;

                const questionId =
                    button.dataset.questionId;

                const status =
                    button.dataset.status;


                await reviewAnswer(
                    submissionId,
                    questionId,
                    status,
                    button
                );

            }
        );

    });
}


// =========================
// ПРОВЕРКА ОТВЕТА
// =========================

async function reviewAnswer(
    submissionId,
    questionId,
    status,
    clickedButton
) {

    // Перед обновлением обязательно
    // запоминаем состояние карточек.
    rememberOpenStates();


    const factor =
        clickedButton.closest(
            ".factor-review"
        );


    const buttons =
        factor.querySelectorAll(
            ".review-button"
        );


    buttons.forEach((button) => {
        button.disabled = true;
    });


    try {

        const response =
            await fetch(
                `/api/admin/submissions/${submissionId}/answers/${questionId}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            status: status
                        })
                }
            );


        if (response.status === 401) {

            window.location.href =
                "/admin-login.html";

            return;
        }


        if (!response.ok) {

            const message =
                await getErrorMessage(
                    response,
                    "Не удалось сохранить проверку"
                );

            throw new Error(message);

        }


        // Данные перечитываются с сервера,
        // но open/closed карточек сохранится.
        await loadSubmissions();

    }

    catch (error) {

        console.error(
            "Ошибка проверки ответа:",
            error
        );


        alert(
            error.message
            ||
            "Не удалось сохранить результат проверки."
        );


        buttons.forEach((button) => {
            button.disabled = false;
        });

    }
}


// =========================
// РУЧНОЕ ОБНОВЛЕНИЕ
// =========================

refreshButton.addEventListener(
    "click",
    loadSubmissions
);


// =========================
// ЗАВЕРШЕНИЕ ПОТОКА
// =========================

if (archiveAllButton) {

    archiveAllButton.addEventListener(
        "click",
        async () => {

            const confirmed =
                confirm(
                    "Все текущие ведомости будут сохранены в CSV "
                    +
                    "и удалены из текущего потока.\n\n"
                    +
                    "Продолжить?"
                );


            if (!confirmed) {
                return;
            }


            archiveAllButton.disabled =
                true;

            archiveAllButton.textContent =
                "Архивируем...";


            try {

                const response =
                    await fetch(
                        "/api/admin/archive-all",
                        {
                            method: "POST"
                        }
                    );


                if (
                    response.status === 401
                ) {

                    window.location.href =
                        "/admin-login.html";

                    return;
                }


                if (!response.ok) {

                    const message =
                        await getErrorMessage(
                            response,
                            "Не удалось архивировать поток"
                        );

                    throw new Error(
                        message
                    );

                }


                // Backend возвращает сам CSV.
                const blob =
                    await response.blob();


                const filename =
                    getFilenameFromResponse(
                        response
                    )
                    ||
                    "quest-archive.csv";


                const url =
                    URL.createObjectURL(
                        blob
                    );


                const link =
                    document.createElement(
                        "a"
                    );


                link.href =
                    url;

                link.download =
                    filename;


                document.body.appendChild(
                    link
                );


                link.click();

                link.remove();


                // Даём браузеру время
                // начать скачивание.
                setTimeout(
                    () => {
                        URL.revokeObjectURL(
                            url
                        );
                    },
                    1000
                );


                // Старых компаний больше нет,
                // очищаем и сохранённые состояния.
                companyOpenState.clear();


                await loadSubmissions();


                alert(
                    "Поток завершён. "
                    +
                    "CSV сохранён, "
                    +
                    "текущие ведомости удалены."
                );

            }

            catch (error) {

                console.error(
                    "Ошибка архивирования:",
                    error
                );


                alert(
                    error.message
                    ||
                    "Не удалось архивировать поток."
                );

            }

            finally {

                archiveAllButton.disabled =
                    false;

                archiveAllButton.textContent =
                    "Завершить поток";

            }

        }
    );
}


// =========================
// ВЫХОД
// =========================

logoutButton.addEventListener(
    "click",
    async () => {

        try {

            await fetch(
                "/api/admin/logout",
                {
                    method: "POST"
                }
            );

        }

        catch (error) {

            console.error(
                "Ошибка выхода:",
                error
            );

        }

        finally {

            window.location.href =
                "/admin-login.html";

        }

    }
);


// =========================
// ОШИБКИ BACKEND
// =========================

// Не пытаемся сначала response.json(),
// потому что при HTTP 500 FastAPI может
// вернуть обычный текст:
//
// Internal Server Error
//
// Именно из-за этого раньше появлялось:
// Unexpected token 'I'...

async function getErrorMessage(
    response,
    fallback
) {

    const text =
        await response.text();


    if (!text) {
        return fallback;
    }


    try {

        const data =
            JSON.parse(text);


        return (
            data.detail
            ||
            data.message
            ||
            fallback
        );

    }

    catch {

        return text;

    }
}


// =========================
// ИМЯ CSV
// =========================

function getFilenameFromResponse(
    response
) {

    const disposition =
        response.headers.get(
            "Content-Disposition"
        );


    if (!disposition) {
        return null;
    }


    // filename*=utf-8''...
    const utf8Match =
        disposition.match(
            /filename\*=UTF-8''([^;]+)/i
        );


    if (utf8Match) {

        return decodeURIComponent(
            utf8Match[1]
        );

    }


    // filename="..."
    const regularMatch =
        disposition.match(
            /filename="?([^";]+)"?/i
        );


    if (regularMatch) {

        return regularMatch[1];

    }


    return null;
}


// =========================
// ТЕКСТ СТАТУСА
// =========================

function getStatusText(status) {

    switch (status) {

        case "correct":
            return "Верно";

        case "partial":
            return "50/50";

        case "incorrect":
            return "Неверно";

        default:
            return "Не проверено";

    }
}


// =========================
// ФОРМАТ ДЕНЕГ
// =========================

function formatMoney(value) {

    const number =
        Number(value);


    if (Number.isInteger(number)) {

        return `${number} руб.`;

    }


    return `${number.toFixed(2)} руб.`;
}


// =========================
// ФОРМАТ ДАТЫ
// =========================

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(
            dateString.replace(
                " ",
                "T"
            )
        );


    return date.toLocaleString(
        "ru-RU"
    );
}


// =========================
// БЕЗОПАСНЫЙ HTML
// =========================

function escapeHtml(text) {

    const element =
        document.createElement("div");


    element.textContent =
        text ?? "";


    return element.innerHTML;
}


// =========================
// СТАРТ
// =========================

loadSubmissions();


// =========================
// АВТООБНОВЛЕНИЕ
// =========================

// Каждые 5 секунд перечитываем данные.
//
// Карточки при этом НЕ меняют
// своё раскрытое/свёрнутое состояние.

setInterval(
    loadSubmissions,
    5000
);