const form = document.querySelector("#team-form");
const teamInput = document.querySelector("#team-name");

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const teamName = teamInput.value.trim();

    if (!teamName) {
        return;
    }

    localStorage.setItem("teamName", teamName);

    window.location.href = "questions.html";
});