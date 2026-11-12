const form =
    document.querySelector("#team-form");

const teamInput =
    document.querySelector("#team-name");

const errorElement =
    document.querySelector("#company-error");

const startButton =
    document.querySelector("#start-button");


form.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const companyName =
            teamInput.value.trim();


        if (!companyName) {
            return;
        }


        errorElement.hidden = true;

        startButton.disabled = true;

        startButton.textContent =
            "Проверяем...";


        try {

            const response =
                await fetch(
                    "/api/company/check",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            companyName:
                                companyName
                        })
                    }
                );


            if (!response.ok) {
                throw new Error(
                    "Не удалось проверить название компании"
                );
            }


            const result =
                await response.json();


            // Компания уже заполняла ведомость
            if (!result.available) {

                errorElement.textContent =
                    "Компания с таким названием уже отправила ведомость.";

                errorElement.hidden = false;

                startButton.disabled = false;

                startButton.textContent =
                    "Перейти к ведомости";

                return;
            }


            // Название свободно
            localStorage.setItem(
                "teamName",
                companyName
            );


            // ?v=2 нужен сейчас ещё и для обхода
            // старого кэша questions.html
            window.location.href =
                "/questions.html?v=2";

        }

        catch (error) {

            console.error(error);

            errorElement.textContent =
                "Не удалось проверить название компании. Попробуйте ещё раз.";

            errorElement.hidden = false;

            startButton.disabled = false;

            startButton.textContent =
                "Перейти к ведомости";

        }

    }
);