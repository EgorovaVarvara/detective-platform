// =========================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =========================

const companyName =
    localStorage.getItem("teamName");


if (!companyName) {
    window.location.href = "index.html";
}


const teamNameElement =
    document.querySelector("#team-name");

const questionsContainer =
    document.querySelector("#questions-container");

const form =
    document.querySelector("#questions-form");

const rulesText =
    document.querySelector("#rules-text");

const rulesToggle =
    document.querySelector("#rules-toggle");

const rulesContent =
    document.querySelector("#rules-content");

const submitButton =
    document.querySelector("#submit-button");


teamNameElement.textContent = companyName;


// Здесь будут храниться
// полученные с backend факторы
let factors = [];


// =========================
// ПРАВИЛА
// =========================

rulesToggle.addEventListener(
    "click",
    () => {

        rulesContent.classList.toggle(
            "rules-content-hidden"
        );

    }
);


// =========================
// ЗАГРУЗКА ФАКТОРОВ
// =========================

async function loadFactors() {

    try {

        const response =
            await fetch("/api/factors");


        if (!response.ok) {

            throw new Error(
                "Не удалось получить список факторов"
            );

        }


        const data =
            await response.json();


        factors = data.factors;

        rulesText.textContent =
            data.rules;


        renderFactors();

    }

    catch (error) {

        console.error(
            "Ошибка загрузки факторов:",
            error
        );


        questionsContainer.innerHTML = `
            <p class="error-message">
                Не удалось загрузить ведомость.
                Попробуйте обновить страницу.
            </p>
        `;


        submitButton.disabled = true;

    }
}


// =========================
// ОТОБРАЖЕНИЕ ФАКТОРОВ
// =========================

function renderFactors() {

    questionsContainer.innerHTML = "";


    factors.forEach((factor) => {

        const factorElement =
            document.createElement("div");


        factorElement.classList.add(
            "question"
        );


        factorElement.innerHTML = `
            <label for="answer-${factor.id}">

                <span class="question-number">
                    ${String(factor.id).padStart(2, "0")}
                </span>

                ${escapeHtml(factor.text)}

            </label>


            <textarea
                id="answer-${factor.id}"
                name="answer-${factor.id}"
                placeholder="Ваше обоснование"
                rows="3"
            ></textarea>
        `;


        questionsContainer.appendChild(
            factorElement
        );

    });
}


// =========================
// ОТПРАВКА ВЕДОМОСТИ
// =========================

form.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        // Защита от повторного клика
        submitButton.disabled = true;

        submitButton.textContent =
            "Отправляем...";


        const formData =
            new FormData(form);


        // Собираем ответы
        // на все 17 факторов
        const answers =
            factors.map((factor) => {

                const answer =
                    formData
                        .get(
                            `answer-${factor.id}`
                        )
                        ?.trim()
                    || "";


                return {

                    questionId:
                        factor.id,

                    question:
                        factor.text,

                    answer:
                        answer

                };

            });


        const data = {

            teamName:
                companyName,

            answers:
                answers

        };


        try {

            const response =
                await fetch(
                    "/api/answers",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(data)

                    }
                );


            // Компания уже отправляла ответы
            if (response.status === 409) {

                const errorData =
                    await response.json();


                alert(
                    errorData.detail
                    ||
                    "Компания с таким названием уже отправила ведомость."
                );


                submitButton.disabled = false;

                submitButton.textContent =
                    "Отправить ведомость";


                return;
            }


            // Любая другая ошибка backend
            if (!response.ok) {

                throw new Error(
                    "Ошибка отправки ведомости"
                );

            }


            const result =
                await response.json();


            console.log(
                "Ведомость сохранена:",
                result
            );


            // После успешной отправки
            // переходим на финальную страницу
            window.location.href =
                "end.html";

        }

        catch (error) {

            console.error(
                "Ошибка отправки:",
                error
            );


            alert(
                "Не удалось отправить ведомость. " +
                "Попробуйте ещё раз."
            );


            submitButton.disabled = false;

            submitButton.textContent =
                "Отправить ведомость";

        }

    }
);


// =========================
// БЕЗОПАСНЫЙ ВЫВОД ТЕКСТА
// =========================

function escapeHtml(text) {

    const element =
        document.createElement("div");


    element.textContent =
        text ?? "";


    return element.innerHTML;
}


// =========================
// ЗАПУСК
// =========================

loadFactors();