const activeToasts = [];

function updateToastPositions() {
    const isMobile = window.innerWidth <= 779;
    // Row height matches the CSS heights plus a gap (desktop: 50px + 12px gap = 62px; mobile: 40px + 8px gap = 48px)
    const rowHeight = isMobile ? 48 : 62;
    const maxStackSlots = isMobile ? 2 : 5;

    activeToasts.forEach((toast, index) => {
        // Enforce max stack rows. Index (maxStackSlots - 1) and above stack on that topmost row.
        const slotIndex = Math.min(index, maxStackSlots - 1);
        const targetY = -slotIndex * rowHeight;

        toast.style.transform = `translateY(${targetY}px) scale(1)`;
        toast.style.zIndex = `${1000 - index}`;
    });
}

export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    let iconId = 'icon-notification';
    if (type === 'error') {
        iconId = 'icon-error';
    } else if (type === 'success') {
        iconId = 'icon-check';
    } else if (type === 'warning') {
        iconId = 'icon-warning';
    }

    toast.innerHTML = `
        <span class="toast-icon" style="display: flex; align-items: center; justify-content: center;">
            <svg class="toast-icon-svg" aria-hidden="true">
                <use href="#${iconId}"></use>
            </svg>
        </span>
        <span class="toast-message">${message}</span>
    `;

    // Start offset for transition entry
    const isMobile = window.innerWidth <= 779;
    const rowHeight = isMobile ? 48 : 62;
    // Position it at slot 0 initially, but offset slightly down and faded out for the transition
    toast.style.opacity = '0';
    toast.style.transform = `translateY(20px) scale(0.95)`;

    container.appendChild(toast);
    
    // Add to active queue (unshift to keep index 0 as newest at the bottom)
    activeToasts.unshift(toast);

    // Limit maximum number of toasts to 9, removing the oldest from the screen/queue immediately if exceeded
    while (activeToasts.length > 9) {
        const oldestToast = activeToasts.pop();
        if (oldestToast) {
            oldestToast.style.opacity = '0';
            oldestToast.style.transform = oldestToast.style.transform.replace('scale(1)', 'scale(0.95)');
            oldestToast.addEventListener('transitionend', () => {
                oldestToast.remove();
            });
        }
    }

    // Trigger position updates on next animation frame
    requestAnimationFrame(() => {
        updateToastPositions();
        toast.style.opacity = '1';
    });

    // Expiration timer
    setTimeout(() => {
        toast.style.opacity = '0';
        // Fade out transition
        toast.style.transform = toast.style.transform.replace('scale(1)', 'scale(0.95)');

        const idx = activeToasts.indexOf(toast);
        if (idx !== -1) {
            activeToasts.splice(idx, 1);
            updateToastPositions();
        }

        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 4000);
}
