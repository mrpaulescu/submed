<?php
include('includes/header.php');

// Sample questions array (you can replace this with database queries later)
$questions = [
    1 => ["question" => "What is the molecular formula for water?", "answers" => ["H2O", "CO2", "O2", "H2"], "correct" => "H2O"],
    2 => ["question" => "What is the chemical symbol for gold?", "answers" => ["Au", "Ag", "Fe", "Pb"], "correct" => "Au"],
    // Add more questions here...
];

// Get the current question number from the URL (e.g., quiz.php?page=1)
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;

// Check if the page number exists in the questions array
if (!isset($questions[$page])) {
    echo "No such question.";
    exit;
}

$currentQuestion = $questions[$page];

// If the form is submitted, check answers and calculate the score
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $score = 0;
    // Check if the user's answer is correct
    if (isset($_POST['answer']) && $_POST['answer'] === $currentQuestion['correct']) {
        $score++;
    }
    
    // Show the result
    echo "<h2>Your score: $score</h2>";
    
    // Link to the next question
    if (isset($questions[$page + 1])) {
        echo '<a href="quiz.php?page=' . ($page + 1) . '">Next Question</a>';
    } else {
        echo '<a href="result.php">See Results</a>'; // Redirect to results page at the end of the quiz
    }
} else {
    // Display the question
    echo "<h2>{$currentQuestion['question']}</h2>";
    
    echo '<form method="POST">';
    foreach ($currentQuestion['answers'] as $answer) {
        echo "<label><input type='radio' name='answer' value='$answer'> $answer</label><br>";
    }
    echo '<input type="submit" value="Submit Answer">';
    echo '</form>';
}

include('includes/footer.php');
?>
