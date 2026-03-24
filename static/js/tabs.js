const tabLinks = {
    "1": "bay-area-santa-cruz.html",
    "2": "central-valley.html",
    "3": "central-coast.html",
    "4": "sacramento-region.html",
    "5": "south-coast.html",
    "6": "inland-empire.html"
};

document.querySelectorAll('input[name="option"]').forEach(radio => {
    radio.addEventListener("change", function() {
        window.location.href = tabLinks[this.id];
    });
});