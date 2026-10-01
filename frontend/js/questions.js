const questions = [
    {
        id: 1,
        text: "Какой ответ на первый вопрос?",
        type: "input"
    },
    {
        id: 2,
        text: "Какой ответ на второй вопрос?",
        type: "input"
    },
    {
        id: 3,
        text: "Какой ответ на третий вопрос?",
        type: "textarea"
    },
    {
        id: 4,
        text: "Какой ответ на четвёртый вопрос?",
        type: "input"
    },
    {
        id: 5,
        text: "Какой ответ на пятый вопрос?",
        type: "textarea"
    }
];


const teamName = localStorage.getItem("teamName");

if (!teamName) {
    window.location.href = "index.html";
}


const teamNameElement = document.querySelector("#team-name");
const questionsContainer = document.querySelector("#questions-container");
const form = document.querySelector("#questions-form");


teamNameElement.textContent = teamName;


// Генерируем вопросы
questions.forEach((question, index) => {

    const questionElement = document.createElement("div");

    questionElement.classList.add("question");


    let answerField;

if (question.type === "textarea") {
    answerField = `
        <textarea
            id="answer-${question.id}"
            name="answer-${question.id}"
            placeholder="Введите ответ"
            rows="4"
        ></textarea>
    `;
} else {
    answerField = `
        <input
            id="answer-${question.id}"
            name="answer-${question.id}"
            type="text"
            placeholder="Введите ответ"
        >
    `;
}


    questionElement.innerHTML = `
        <label for="answer-${question.id}">

            <span class="question-number">
                ${String(index + 1).padStart(2, "0")}
            </span>

            ${question.text}

        </label>

        ${answerField}
    `;


    questionsContainer.appendChild(questionElement);
});


// Отправка формы
form.addEventListener("submit", (event) => {

    event.preventDefault();

    const formData = new FormData(form);

    const answers = questions.map((question) => {
    const answer = formData.get(`answer-${question.id}`)?.trim() || "";

    return {
        questionId: question.id,
        question: question.text,
        answer: answer
    };
});


    const data = {
        teamName: teamName,
        answers: answers
    };


    console.log(data);


    // Пока сохраняем локально.
    // Потом здесь будет отправка на backend.
    localStorage.setItem(
        "questAnswers",
        JSON.stringify(data)
    );


    window.location.href = "end.html";
});