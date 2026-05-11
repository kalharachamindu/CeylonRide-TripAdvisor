// Shared Frontend Logic for Discover Ceylon

async function fetchSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Settings not found');
        return await response.json();
    } catch (e) {
        console.warn('Failed to fetch settings:', e);
        return {};
    }
}

async function fetchProvinces() {
    try {
        const response = await fetch('/api/provinces');
        if (!response.ok) throw new Error('Provinces not found');
        return await response.json();
    } catch (e) {
        console.warn('Failed to fetch provinces:', e);
        return [];
    }
}

async function updateWhatsAppLinks() {
    const settings = await fetchSettings();
    if (!settings.whatsapp_number) return;
    
    const whatsappNumber = settings.whatsapp_number;
    const whatsappLinks = document.querySelectorAll('a[href^="https://wa.me/"]');
    whatsappLinks.forEach(link => {
        link.href = `https://wa.me/${whatsappNumber.replace('+', '')}`;
    });

    const persistentWhatsApp = document.querySelector('.persistent-whatsapp');
    if (persistentWhatsApp) {
        persistentWhatsApp.href = `https://wa.me/${whatsappNumber.replace('+', '')}`;
    }
}

// Function to handle opening province details
function openProvince(id) {
    window.location.href = `province.html?id=${id}`;
}

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
    updateWhatsAppLinks();
    
    // Standardize navigation links
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        const text = link.textContent.trim();
        if (text === 'Home') link.href = 'home.html';
        if (text === 'About Us') link.href = 'about-us.html';
        if (text === 'Contact Us') link.href = 'contact-us.html';
        if (text === 'Admin') link.href = 'admin-login.html';
    });
});
