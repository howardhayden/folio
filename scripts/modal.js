function openModal(modalId) {
    var modal = document.getElementById(modalId);
    modal.style.display = 'block';

    // Apply blur to all container elements
    var containers = document.querySelectorAll('.container');
    containers.forEach(function(container) {
        container.style.filter = "blur(5px)";
    });
}

function closeModal() {
    var modals = document.getElementsByClassName('modal');
    for (var i = 0; i < modals.length; i++) {
        modals[i].style.display = 'none';
    }

    // Remove blur from all container elements
    var containers = document.querySelectorAll('.container');
    containers.forEach(function(container) {
        container.style.filter = "none";
    });
}

// Add click event to modal content to stop propagation
function stopPropagation(event) {
    event.stopPropagation();
}

// Add event listener to DOM
document.addEventListener('DOMContentLoaded', function(event) {
    var modals = document.getElementsByClassName('modal');
    for (var i = 0; i < modals.length; i++) {
        var content = modals[i].querySelector('.modal-content');
        content.addEventListener('click', stopPropagation, false);
    }
});

// Close modal on outside click or touch
function handleOutsideClickOrTouch(event) {
    var modals = document.getElementsByClassName('modal');
    for (var i = 0; i < modals.length; i++) {
        if (event.target == modals[i]) {
            closeModal();
        }
    }
}

window.onclick = handleOutsideClickOrTouch;
window.ontouchstart = handleOutsideClickOrTouch;
