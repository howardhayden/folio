# README.md

## Project Overview
This project is a personal website featuring an introduction page, a resume page, a digital bookshelf, and a tools page. The site is built using Bootstrap for styling and custom JavaScript for enhanced functionality. It provides a clean, responsive, and accessible interface for visitors to learn about the site owner.

## Table of Contents
- [Project Overview](#project-overview)
- [Information Architecture](#information-architecture)
- [Technology Stack](#technology-stack)
- [Scripts](#scripts)
- [Styling](#styling)
- [Accessibility](#accessibility)
- [Fonts and Licenses](#fonts-and-licenses)

## Information Architecture
The website consists of the following main sections:
1. **Index Page (`index.html`)**: The Index page introduces the site owner with a brief bio and displays ASCII art. The ASCII art on the index page is dynamically resized to fit the container width. The `ascii.js` script calculates the maximum number of characters in a line of the ASCII art and adjusts the font size based on the container's width. This ensures that the ASCII art remains properly scaled and legible across different screen sizes and devices. The script also listens for window resize events to continuously maintain the optimal font size. With scripts disabled, the ASCII art does not adjust. The Q&A subheading pulses at approximately 75bpm, a safe estimation for a heart at rest while one is focused.
2. **Resume Page (`resume.html`)**: The Resume page presents the site owner's work experience and academic background in a visually engaging timeline format. Key milestones such as job roles, internships, and degrees are displayed as timeline entries, alternating between the left and right sides for better readability and aesthetic balance. Each entry includes detailed information about the role, responsibilities, and the period of involvement. This structured layout allows visitors to easily follow the chronological progression of the site owner's career and educational achievements. The use of icons symbolize the roles with commonly associated items. The color scheme, static accented with blue and green, represent the mossy, quickly rippling rill of the site owner's hometown. Dark red is used to reference the red brick of the site owner's alma mater. With scripts disabled, the information otherwise displayed in modals is displayed as or within timeline events.
3. **Shelf Page (`shelf.html`)**: The Shelf page functions as a digital repository, organizing and displaying documents of multiple types referred to as "papers," aligning with archival practices. The dropdown search allows users to filter papers by language, publisher, author, and collection, facilitating precise and efficient searches. The search results are dynamically shuffled, providing a fresh and varied presentation. The glass blur effect applied to the rest of the page when the dropdown is active helps maintain focus on the search while keeping the background visible, ensuring cognitive accessibility.
With scripts disabled, a paper providing notice that scripts are disabled is displayed. Other papers are not displayed. The Search dropdown is not displayed.
4. **Tools Page (`tools.html`)**: The Tools page emphasizes key features and benefits of various productivity and social tools used by the site owner. Each tool is detailed with a brief description and a list of core attributes of product differentiation. This information helps visitors understand the value and functionality of each tool versus competitive alternatives, promoting critical consideration regarding their own tools.

## Technology Stack
- **Frontend Framework**: Bootstrap 4.5.2.
- **Font**: Jost (via Google Fonts).
- **JavaScript Libraries**: Custom scripts for handling interactions.
- **Hosting**: GitHub.

## Scripts
### `ascii.js`
- Adjusts the text size of the ASCII art on the index page to fit the container dynamically.

### `modal.js`
- Handles the opening and closing of modals, including click propagation to prevent accidental closing.

### `search.js`
- Manages the dropdown search functionality, applying blur effects to the rest of the page when the dropdown is active.

### `shelf-script.js`
- Generates and displays "paper" cards on the shelf page.
- Filters papers based on user input in search fields.
- Uses a shuffle algorithm to randomize the display order of papers.
- Papers are used instead of books to align with the archival nature of the documents and the detailed metadata associated with each paper.

## Styling
- **Global Styles**: Defined in `style.css`, including base styles for typography, layout, and responsive design.
- **ASCII Art Styling**: Ensures the ASCII art on the index page scales appropriately across different screen sizes by dynamically adjusting the font size based on container width.
- **Color Scheme**: Uses a minimalist palette focusing on readability and accessibility, with key colors defined as CSS variables.

## Accessibility
- **JavaScript Disabled**: Includes fallbacks to ensure critical information is still accessible when JavaScript is disabled, such as a message indicating the need for JavaScript and default content display.
- **Screen Reader Compatibility**: Uses proper HTML tags and ARIA attributes to ensure compatibility with screen readers.

## Fonts and Licenses
- **Jost Font**: Licensed under the SIL Open Font License (OFL). It is included via Google Fonts and provides a modern, clean look that enhances readability.
- **MIT License**: This project is licensed under the MIT License, allowing for open usage and modification.
