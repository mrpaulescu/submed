async function loadQuestions() {
    const response = await fetch("get_questions.php");
    const questions = await response.json();

    let quizContainer = document.getElementById("quiz-container");
    quizContainer.innerHTML = "";

    questions.forEach((question, index) => {
        let questionHTML = `<p>${index + 1}. ${question.text}</p>`;
        
        question.answers.forEach(answer => {
            questionHTML += `
                <label>
                    <input type="radio" name="question_${question.question_id}" value="${answer.id}">
                    ${answer.text}
                </label><br>
            `;
        });

        quizContainer.innerHTML += questionHTML;
    });

    quizContainer.innerHTML += `<button onclick="submitQuiz()">Submit</button>`;
}

async function submitQuiz() {
    let answers = {};
    document.querySelectorAll("input[type=radio]:checked").forEach(input => {
        let questionId = input.name.split("_")[1];
        answers[questionId] = input.value;
    });

    const response = await fetch("submit_exam.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_id: 1, answers })
    });

    const result = await response.json();
    alert("Scorul tău: " + result.score);
}
