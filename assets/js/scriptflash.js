const flashcards = [
    { formula: "C6H12O6", name: "Glucose" },
    { formula: "H2O", name: "Water" },
    { formula: "CO2", name: "Carbon Dioxide" },
    { formula: "O2", name: "Oxygen" },
  ];
  
  let currentIndex = 0;
  
  const shuffleBtn = document.getElementById("shuffleBtn");
  const nextBtn = document.getElementById("nextBtn");
  const flashcard = document.querySelector(".flashcard");
  const cardFront = document.querySelector(".card-front");
  const cardBack = document.querySelector(".card-back");
  
  function showCard(index) {
    const card = flashcards[index];
    cardFront.innerHTML = `<p>Formula: ${card.formula}</p>`;
    cardBack.innerHTML = `<p>${card.name}</p>`;
  }
  
  function shuffleCards() {
    for (let i = flashcards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flashcards[i], flashcards[j]] = [flashcards[j], flashcards[i]];
    }
    currentIndex = 0;
    showCard(currentIndex);
  }
  
  shuffleBtn.addEventListener("click", shuffleCards);
  
  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % flashcards.length;
    showCard(currentIndex);
  });
  
  // Initialize with first card
  showCard(currentIndex);
  