
import footerCopyrightHandler from "../js/footer.js";


footerCopyrightHandler()
document.addEventListener('DOMContentLoaded', function() {
     
// Function to update the countdown for May 22 Presimulare Cluj
function updateCountdown() {
    const targetDate = new Date("March 22, 2025 00:00:00").getTime();
    const now = new Date().getTime();
    const timeLeft = targetDate - now;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Display the time left until May 22
    document.getElementById("timeUntilMay22").innerHTML = ` ${days} zile, ${hours} ore, ${minutes} minute, ${seconds} secunde.⏰`;
}

function updateCountdown2() {
    const targetDate = new Date("May 11, 2025 00:00:00").getTime();
    const now = new Date().getTime();
    const timeLeft = targetDate - now;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Display the time left until May 22
    document.getElementById("timeUntilMarch9").innerHTML = ` ${days} zile, ${hours} ore, ${minutes} minute, ${seconds} secunde.⏰`;
}
// Update countdown every second
setInterval(updateCountdown2, 1000);


// Update countdown every second
setInterval(updateCountdown, 1000);
  });
  
// Function to update the countdown for May 22 Presimulare Cluj
function updateCountdown() {
    const targetDate = new Date("March 22, 2025 00:00:00").getTime();
    const now = new Date().getTime();
    const timeLeft = targetDate - now;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Display the time left until May 22
    document.getElementById("timeUntilMarch9").innerHTML = ` ${days} zile, ${hours} ore, ${minutes} minute, ${seconds} secunde.⏰`;
}

function updateCountdown2() {
    const targetDate = new Date("May 11, 2025 00:00:00").getTime();
    const now = new Date().getTime();
    const timeLeft = targetDate - now;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Display the time left until May 22
    document.getElementById("timeUntilMay11").innerHTML = ` ${days} zile, ${hours} ore, ${minutes} minute, ${seconds} secunde.⏰`;
}
// Update countdown every second
setInterval(updateCountdown2, 1000);


// Update countdown every second
setInterval(updateCountdown, 1000);

function handleCurrentYear() {
    const year = new Date().getFullYear()
    const currenYear = document.querySelector("#currentYear")

    currenYear.innerText = year;
}

handleCurrentYear()

