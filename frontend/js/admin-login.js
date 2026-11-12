const form =
    document.querySelector(
        "#admin-login-form"
    );

const passwordInput =
    document.querySelector("#password");

const errorElement =
    document.querySelector("#login-error");


form.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        errorElement.hidden = true;

        const response =
            await fetch(
                "/api/admin/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        password:
                            passwordInput.value
                    })
                }
            );

        if (!response.ok) {
            errorElement.textContent =
                "Неверный пароль.";

            errorElement.hidden = false;

            return;
        }

        window.location.href =
            "/admin";
    }
);
