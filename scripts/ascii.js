function adjustTextSize() {
    const asciiContainer = document.getElementById('ascii');
    const asciiPre = asciiContainer.querySelector('pre');
    const lines = asciiPre.textContent.split('\n');
    const maxChars = Math.max(...lines.map(line => line.length));
    const asciiContainerWidth = asciiContainer.offsetWidth;

    // Closest approximation to M char width on all present testing screens
    let fontSize = (asciiContainerWidth / maxChars) * 1.82;

    asciiPre.style.fontSize = `${fontSize}px`;
}

window.addEventListener("load", adjustTextSize);
window.addEventListener("resize", adjustTextSize);
