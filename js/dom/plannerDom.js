export function getPlannerDOMElements() {
    return {
        customMaxLevel: {
            common: document.getElementById('planner-common-max-level'),
            epic: document.getElementById('planner-epic-max-level'),
        },
        heroCarouselContent: document.getElementById('planner-hero-carousel-content'),
        plannerPageDots: document.getElementById('planner-page-dots'),
    };
}