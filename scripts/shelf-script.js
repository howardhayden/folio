window.onload = function () {
  const papershelf = document.getElementById("papershelf");
  const languageInput = document.getElementById("languageInput");
  const collectionInput = document.getElementById("collectionInput");
  const publisherInput = document.getElementById("publisherInput");
  const authorInput = document.getElementById("authorInput");

  // Fisher-Yates shuffle
  function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;

    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
  }

  function formatDate(dateInput) {
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  if (!dateInput || typeof dateInput !== "string") {
    return "Invalid Date";
  }

  const dateString = dateInput.trim();

  // Explicit era: "180 C.E." or "44 B.C.E."
  const eraMatch = dateString.match(/^(\d{1,4})\s*(C\.E\.|B\.C\.E\.)$/i);
  if (eraMatch) {
    const year = parseInt(eraMatch[1], 10);
    const era = eraMatch[2].toUpperCase() === "C.E." ? "C.E." : "B.C.E.";
    return `${year} ${era}`;
  }

  // Year only
  if (/^\d{1,4}$/.test(dateString)) {
    const year = parseInt(dateString, 10);
    return year < 1000 ? `${year} C.E.` : `${year}`;
  }

  // Negative year
  if (/^-\d{1,4}$/.test(dateString)) {
    return `${Math.abs(parseInt(dateString, 10))} B.C.E.`;
  }

  // Month and year
  const monthYearMatch =
    dateString.match(/^(\d{1,2})[/-](\d{4})$/) ||
    dateString.match(/^(\d{4})[/-](\d{1,2})$/);

  if (monthYearMatch) {
    let month;
    let year;

    if (/^\d{1,2}[/-]\d{4}$/.test(dateString)) {
      month = parseInt(monthYearMatch[1], 10);
      year = parseInt(monthYearMatch[2], 10);
    } else {
      year = parseInt(monthYearMatch[1], 10);
      month = parseInt(monthYearMatch[2], 10);
    }

    if (month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric"
      });
    }

    return dateString;
  }

  // Full date
  const date = new Date(dateString);

  if (!isNaN(date.getTime())) {
    const timeZoneOffset = date.getTimezoneOffset() * 60 * 1000;
    const adjustedDate = new Date(date.getTime() + timeZoneOffset);

    return adjustedDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  return dateString;
}
  
  function generatePaperCards(papers) {
    const shuffledPapers = shuffleArray(papers);
    papershelf.innerHTML = "";
    shuffledPapers.forEach((paper) => {
      const card = document.createElement("div");
      card.classList.add("card");

      const cardBody = document.createElement("div");
      cardBody.classList.add("card-body");

      const title = document.createElement("h5");
      title.classList.add("card-title");
      title.textContent = paper.title;

      const metaList = document.createElement("dl");
      metaList.classList.add("paper-meta");

      const languageItem = createMetaListItem("Language", paper.language.join(", "));
      metaList.appendChild(languageItem);

      const publisherItem = createMetaListItem("Publisher", paper.publisher.join(", "));
      metaList.appendChild(publisherItem);

      const dateItem = createMetaListItem("Date", formatDate(paper.date));
      metaList.appendChild(dateItem);

      const authorsItem = createMetaListItem("Author(s)", paper.authors.join(", "));
      metaList.appendChild(authorsItem);

      const collectionsItem = createMetaListItem("Collection(s)", paper.collections.join(", "));
      metaList.appendChild(collectionsItem);

      cardBody.appendChild(title);
      cardBody.appendChild(metaList);
      card.appendChild(cardBody);

      papershelf.appendChild(card);
    });
  }

  function createMetaListItem(label, value) {
    const item = document.createElement("div");
    item.classList.add("paper-meta-item");

    const labelElement = document.createElement("dt");
    labelElement.textContent = label;
    item.appendChild(labelElement);

    const valueElement = document.createElement("dd");
    valueElement.textContent = value;
    item.appendChild(valueElement);

    return item;
  }

  function filterPapers() {
    const languageInputValue = languageInput.value.toLowerCase();
    const collectionInputValue = collectionInput.value.toLowerCase();
    const publisherInputValue = publisherInput.value.toLowerCase();
    const authorInputValue = authorInput.value.toLowerCase();
  
    const filteredPapers = papers.filter((paper) => {
      const language = paper.language.join(", ").toLowerCase();
      const collections = paper.collections.map((collection) => collection.toLowerCase());
      const publisher = paper.publisher.join(", ").toLowerCase();
      const authors = paper.authors.join(", ").toLowerCase();
  
      return (
        (languageInputValue === "" || language.includes(languageInputValue)) &&
        (collectionInputValue === "" || collections.some((collection) => collection.includes(collectionInputValue))) &&
        (publisherInputValue === "" || publisher.includes(publisherInputValue)) &&
        (authorInputValue === "" || authors.includes(authorInputValue))
      );
    });
  
    generatePaperCards(filteredPapers);
  }

  languageInput.addEventListener("input", filterPapers);
  collectionInput.addEventListener("input", filterPapers);
  publisherInput.addEventListener("input", filterPapers);
  authorInput.addEventListener("input", filterPapers);

  generatePaperCards(papers);
};
