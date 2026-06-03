export const developmentSupportData = [
    { 
        id: 'changelog',
        icon: 'changelog',
        i18nLabel: 'settings.changelog',
        i18nAction: 'actions.view',
        colorClass: 'btn-changelog',
        actionType: 'modal'
    },
    { 
        id: 'github',
        url: 'https://github.com/abhis-s/oreCalc', 
        icon: 'github',
        i18nLabel: 'settings.github',
        i18nAction: 'actions.visit',
        colorClass: 'btn-github',
        actionType: 'link'
    },
    { 
        id: 'crowdin',
        url: 'https://crowdin.com/project/orecalc', 
        icon: 'crowdin',
        i18nLabel: 'settings.crowdin',
        i18nAction: 'actions.visit',
        colorClass: 'btn-crowdin',
        actionType: 'link'
    },
    { 
        id: 'buyMeACoffee',
        url: 'https://buymeacoffee.com/orecalc', 
        icon: 'bmc',
        i18nLabel: 'settings.buyMeACoffee',
        i18nAction: 'actions.support',
        colorClass: 'btn-bmc',
        actionType: 'link'
    },
    {
        id: 'bugReport',
        icon: 'bug',
        i18nLabel: 'settings.bugReport',
        i18nAction: 'actions.report',
        colorClass: 'btn-bug',
        actionType: 'modal'
    },
    {
        id: 'contact',
        icon: 'mail',
        i18nLabel: 'settings.contact',
        i18nAction: 'actions.view',
        colorClass: 'btn-contact',
        actionType: 'modal'
    }
];

export const transparencyData = [
    {
        id: 'privacy',
        icon: 'shield',
        i18nLabel: 'settings.privacyPolicy',
        i18nAction: 'actions.view',
        colorClass: 'btn-privacy',
        actionType: 'modal'
    },
    {
        id: 'termsOfUse',
        icon: 'article',
        i18nLabel: 'settings.termsOfUse',
        i18nAction: 'actions.view',
        colorClass: 'btn-terms-of-use',
        actionType: 'modal'
    },
    {
        id: 'licenses',
        icon: 'library',
        i18nLabel: 'settings.licenses',
        i18nAction: 'actions.view',
        colorClass: 'btn-licenses',
        actionType: 'placeholder',
        badge: 'settings.badges.comingSoon'
    },
    {
        id: 'runningCosts',
        icon: 'costs',
        i18nLabel: 'settings.runningCosts',
        i18nAction: 'actions.view',
        colorClass: 'btn-costs',
        actionType: 'placeholder',
        badge: 'settings.badges.comingSoon'
    }
];
