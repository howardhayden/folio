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
    // Handle case where input is already a Date object
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        console.debug('Received valid Date object:', dateInput);
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        const timeZoneOffset = dateInput.getTimezoneOffset() * 60 * 1000;
        const adjustedDate = new Date(dateInput.getTime() + timeZoneOffset);
        return adjustedDate.toLocaleDateString('en-US', options);
    }

    // Ensure input is a string and not null/undefined
    if (!dateInput || typeof dateInput !== 'string') {
        console.warn('Invalid date input (not a string or null/undefined):', dateInput);
        return 'Invalid Date';
    }

    // Trim whitespace
    const dateString = dateInput.trim();
    console.debug('Processing date string:', dateString);

    // Check for year with explicit C.E./B.C.E. (e.g., "180 C.E.", "44 B.C.E.")
    const eraMatch = dateString.match(/^(\d{1,4})\s*(C\.E\.|B\.C\.E\.)$/i);
    if (eraMatch) {
        const year = parseInt(eraMatch[1]);
        const era = eraMatch[2].toUpperCase() === 'C.E.' ? 'C.E.' : 'B.C.E.';
        console.debug(`Detected year with explicit era: ${year} ${era}`);
        return `${year} ${era}`;
    }

    // Check for year-only (1-4 digits, e.g., "180", "1859")
    if (/^\d{1,4}$/.test(dateString)) {
        const year = parseInt(dateString);
        console.debug(`Detected year-only: ${year}`);
        // Years before 1000 get "C.E.", years 1000 and later do not
        return year < 1000 ? `${year} C.E.` : `${year}`;
    }

    // Check for negative years (e.g., "-44" for 44 B.C.E.)
    if (/^-\d{1,4}$/.test(dateString)) {
        const year = parseInt(dateString.replace('-', ''));
        console.debug(`Detected negative year (B.C.E.): ${year}`);
        return `${year} B.C.E.`;
    }

    // Check for month-year (MM/YYYY, MM-YYYY, or YYYY-MM, e.g., "05/2023", "05-2023", "2023-05")
    const monthYearMatch = dateString.match(/^(\d{1,2})[/-](\d{4})$/) || dateString.match(/^(\d{4})[/-](\d{1,2})$/);
    if (monthYearMatch) {
        let month, year;
        if (dateString.match(/^(\d{1,2})[/-](\d{4})$/)) {
            month = parseInt(monthYearMatch[1]);
            year = monthYearMatch[2];
        } else {
            month = parseInt(monthYearMatch[2]);
            year = monthYearMatch[1];
        }
        // Validate month (1-12)
        if (month >= 1 && month <= 12) {
            try {
                const monthName = new Date(`2000-${month}-01`).toLocaleString('en-US', { month: 'short' });
                console.debug('Detected month-year format:', `${monthName} ${year}`);
                return `${monthName} ${year}`;
            } catch (e) {
                console.warn('Error formatting month-year:', dateString, e);
                return dateString;
            }
        }
        console.warn('Invalid month in month-year format:', dateString);
        return dateString;
    }

    // Try parsing as a full date (e.g., "2022-09-20", "05/15/2023", "2023/05/15")
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            const options = { month: 'short', day: 'numeric', year: 'numeric' };
            const timeZoneOffset = date.getTimezoneOffset() * 60 * 1000;
            const adjustedDate = new Date(date.getTime() + timeZoneOffset);
            const formattedDate = adjustedDate.toLocaleDateString('en-US', options);
            console.debug('Detected valid full date:', formattedDate);
            return formattedDate;
        }
    } catch (e) {
        console.warn('Error parsing full date:', dateString, e);
    }

    // Return original input if date is invalid or unparseable
    console.warn('Unparseable date, returning original:', dateString);
    return dateString;
``}
  
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
