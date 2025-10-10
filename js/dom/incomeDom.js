export function getIncomeDOMElements() {
    return {
        allIncomeCards: document.querySelectorAll('.income-card'),
        home: {
            incomeCard: {
                container: document.getElementById('home-ore-income-card'),
                timeframe: document.getElementById('home-income-timeframe-select'),
                header: {
                    container: document.querySelector('.income-header'),
                    shiny: document.getElementById('home-table-header-ore-display-shiny'),
                    glowy: document.getElementById('home-table-header-ore-display-glowy'),
                    starry: document.getElementById('home-table-header-ore-display-starry'),
                },
                tableContainer: document.querySelector('.income-content'),
                tableExpanderBtn: document.getElementById('toggle-income-btn'),
                table: {
                    starBonus: {
                        shiny: document.getElementById('home-income-table-star-bonus-shiny'),
                        glowy: document.getElementById('home-income-table-star-bonus-glowy'),
                        starry: document.getElementById('home-income-table-star-bonus-starry'),
                        resource: document.getElementById('home-star-bonus-resource'),
                        icon: document.getElementById('home-display-league-icon'),
                    },
                    clanWar: {
                        shiny: document.getElementById('home-income-table-clan-war-shiny'),
                        glowy: document.getElementById('home-income-table-clan-war-glowy'),
                        starry: document.getElementById('home-income-table-clan-war-starry'),
                        resource: document.getElementById('home-clan-war-resource'),
                    },
                    cwl: {
                        shiny: document.getElementById('home-income-table-cwl-shiny'),
                        glowy: document.getElementById('home-income-table-cwl-glowy'),
                        starry: document.getElementById('home-income-table-cwl-starry'),
                        resource: document.getElementById('home-cwl-resource'),
                    },
                    raidMedal: {
                        shiny: document.getElementById('home-income-table-raid-medal-shiny'),
                        glowy: document.getElementById('home-income-table-raid-medal-glowy'),
                        starry: document.getElementById('home-income-table-raid-medal-starry'),
                        resource: document.getElementById('home-raid-medal-resource'),
                    },
                    gem: {
                        shiny: document.getElementById('home-income-table-gem-shiny'),
                        glowy: document.getElementById('home-income-table-gem-glowy'),
                        starry: document.getElementById('home-income-table-gem-starry'),
                        resource: document.getElementById('home-gem-resource'),
                    },
                    eventPass: {
                        shiny: document.getElementById('home-income-table-event-pass-shiny'),
                        glowy: document.getElementById('home-income-table-event-pass-glowy'),
                        starry: document.getElementById('home-income-table-event-pass-starry'),
                        resource: document.getElementById('home-event-pass-resource'),
                    },
                    eventTrader: {
                        shiny: document.getElementById('home-income-table-event-trader-shiny'),
                        glowy: document.getElementById('home-income-table-event-trader-glowy'),
                        starry: document.getElementById('home-income-table-event-trader-starry'),
                        resource: document.getElementById('home-event-trader-resource'),
                    },
                    shopOffer: {
                        shiny: document.getElementById('home-income-table-shop-offer-shiny'),
                        glowy: document.getElementById('home-income-table-shop-offer-glowy'),
                        starry: document.getElementById('home-income-table-shop-offer-starry'),
                        resource: document.getElementById('home-shop-offer-resource'),
                    },
                    championship: {
                        shiny: document.getElementById('home-income-table-championship-shiny'),
                        glowy: document.getElementById('home-income-table-championship-glowy'),
                        starry: document.getElementById('home-income-table-championship-starry'),
                        resource: document.getElementById('home-championship-resource'),
                    },
                    totalRow: {
                        shiny: document.getElementById('home-income-table-total-shiny'),
                        glowy: document.getElementById('home-income-table-total-glowy'),
                        starry: document.getElementById('home-income-table-total-starry'),
                    }
                },
                resources: {
                    leagueIcon: document.getElementById('home-display-league-icon'),
                    leagueRequirement: document.getElementById('home-display-league-requirement'),
                    cwlParticipations: document.getElementById('home-display-cwl-participations'),
                    clanWarIcon: document.getElementById('home-display-clan-icon'),
                    clanWarParticipations: document.getElementById('home-display-clan-war-participations'),
                    raidMedals: document.getElementById('home-display-raid-medals'),
                    eventMedals: document.getElementById('home-display-event-medals'),
                    gems: document.getElementById('home-display-gems'),
                    moneyValue: document.getElementById('home-money-value'),
                    moneySymbol: document.getElementById('home-money-symbol'),
                }
            },
            results: {
                quantity: {
                    shiny: document.getElementById('home-result-quantity-shiny'),
                    glowy: document.getElementById('home-result-quantity-glowy'),
                    starry: document.getElementById('home-result-quantity-starry'),
                },
                time: {
                    shiny: {
                        years: document.getElementById('home-result-time-shiny-years'),
                        months: document.getElementById('home-result-time-shiny-months'),
                        days: document.getElementById('home-result-time-shiny-days'),
                    },
                    glowy: {
                        years: document.getElementById('home-result-time-glowy-years'),
                        months: document.getElementById('home-result-time-glowy-months'),
                        days: document.getElementById('home-result-time-glowy-days'),
                    },
                    starry: {
                        years: document.getElementById('home-result-time-starry-years'),
                        months: document.getElementById('home-result-time-starry-months'),
                        days: document.getElementById('home-result-time-starry-days'),
                    },
                },
                date: {
                    shiny: document.getElementById('home-result-date-shiny'),
                    glowy: document.getElementById('home-result-date-glowy'),
                    starry: document.getElementById('home-result-date-starry'),
                },
            }
        },
        starBonus: {
            league: document.getElementById('inc-star-bonus-league-select'),
            is4xEnabled: document.getElementById('inc-star-bonus-4x-toggle'),
            display: {
                daily: {
                    shiny: document.getElementById('inc-star-bonus-shiny-daily-value'),
                    glowy: document.getElementById('inc-star-bonus-glowy-daily-value'),
                    starry: document.getElementById('inc-star-bonus-starry-daily-value'),
                },
                monthly: {
                    shiny: document.getElementById('inc-star-bonus-shiny-monthly-value'),
                    glowy: document.getElementById('inc-star-bonus-glowy-monthly-value'),
                    starry: document.getElementById('inc-star-bonus-starry-monthly-value'),
                },
            },
        },
        shopOffers: {
            dropdown: document.getElementById('inc-shop-offer-select'),
            checkboxes: document.getElementById('shop-offer-checkboxes'),
            display: {
                eur: document.getElementById('inc-shop-offer-eur-monthly-value'),
                usd: document.getElementById('inc-shop-offer-usd-monthly-value'),
                dynamic: document.getElementById('inc-shop-offer-dynamic-monthly-value'),
                dynamicCurrencySymbol: document.getElementById('inc-shop-offer-dynamic-currency-symbol'),
                shiny: document.getElementById('inc-shop-offer-shiny-monthly-value'),
                glowy: document.getElementById('inc-shop-offer-glowy-monthly-value'),
                starry: document.getElementById('inc-shop-offer-starry-monthly-value'),
            }
        },
        raids: {
            earned: document.getElementById('inc-raid-medals-total-input'),
            remaining: document.getElementById('raid-medals-remaining'),
            offersContainer: document.getElementById('inc-raid-medal-trader-offers'),
            display: {
                weekly: {
                    shiny: document.getElementById('inc-raid-medal-shiny-weekly-value'),
                    glowy: document.getElementById('inc-raid-medal-glowy-weekly-value'),
                    starry: document.getElementById('inc-raid-medal-starry-weekly-value'),
                },
                monthly: {
                    shiny: document.getElementById('inc-raid-medal-shiny-monthly-value'),
                    glowy: document.getElementById('inc-raid-medal-glowy-monthly-value'),
                    starry: document.getElementById('inc-raid-medal-starry-monthly-value'),
                }
            }
        },
        gems: {
            offersContainer: document.getElementById('inc-gem-trader-offers'),
            display: {
                weekly: {
                    shiny: document.getElementById('inc-gem-shiny-weekly-value'),
                    glowy: document.getElementById('inc-gem-glowy-weekly-value'),
                    starry: document.getElementById('inc-gem-starry-weekly-value'),
                },
                monthly: {
                    shiny: document.getElementById('inc-gem-shiny-monthly-value'),
                    glowy: document.getElementById('inc-gem-glowy-monthly-value'),
                    starry: document.getElementById('inc-gem-starry-monthly-value'),
                },
            },
        },
        eventPass: {
            passType: document.getElementById('inc-event-pass-select'),
            storeMedalsClaimed: document.getElementById('inc-store-medals-select'),
            equipmentBought: document.getElementById('inc-event-equipment-bought-select'),
            display: {
                bimonthly: {
                    shiny: document.getElementById('inc-event-pass-shiny-bimonthly-value'),
                    glowy: document.getElementById('inc-event-pass-glowy-bimonthly-value'),
                    starry: document.getElementById('inc-event-pass-starry-bimonthly-value'),
                },
                monthly: {
                    shiny: document.getElementById('inc-event-pass-shiny-monthly-value'),
                    glowy: document.getElementById('inc-event-pass-glowy-monthly-value'),
                    starry: document.getElementById('inc-event-pass-starry-monthly-value'),
                },
            },
        },
        eventTrader: {
            offersContainer: document.getElementById('inc-event-trader-offers'),
            total: document.getElementById('inc-event-medals-total-value'),
            remaining: document.getElementById('inc-event-medals-remaining-value'),
            packs: {
                shiny: document.getElementById('inc-event-shiny-packs-input'),
                glowy: document.getElementById('inc-event-glowy-packs-input'),
                starry: document.getElementById('inc-event-starry-packs-input'),
            },
            display: {
                 bimonthly: {
                    shiny: document.getElementById('inc-event-trader-shiny-bimonthly-value'),
                    glowy: document.getElementById('inc-event-trader-glowy-bimonthly-value'),
                    starry: document.getElementById('inc-event-trader-starry-bimonthly-value'),
                },
                monthly: {
                    shiny: document.getElementById('inc-event-trader-shiny-monthly-value'),
                    glowy: document.getElementById('inc-event-trader-glowy-monthly-value'),
                    starry: document.getElementById('inc-event-trader-starry-monthly-value'),
                },
            }
        },
        clanWar: {
            warsPerMonthInput: document.getElementById('inc-clan-war-wars-per-month-input'),
            oresPerAttack: {
                shinyInput: document.getElementById('inc-clan-war-shiny-bonus-input'),
                glowyInput: document.getElementById('inc-clan-war-glowy-bonus-input'),
                starryInput: document.getElementById('inc-clan-war-starry-bonus-input'),
            },
            warResults: {
                winRateInput: document.getElementById('inc-clan-war-win-rate-input'),
                drawRateInput: document.getElementById('inc-clan-war-draw-rate-input'),
                lossRateValue: document.getElementById('inc-clan-war-loss-rate-value'),
            },
            display: {
                perWar: {
                    shiny: document.getElementById('inc-clan-war-shiny-perWar-value'),
                    glowy: document.getElementById('inc-clan-war-glowy-perWar-value'),
                    starry: document.getElementById('inc-clan-war-starry-perWar-value'),
                },
                monthly: {
                    shiny: document.getElementById('inc-clan-war-shiny-monthly-value'),
                    glowy: document.getElementById('inc-clan-war-glowy-monthly-value'),
                    starry: document.getElementById('inc-clan-war-starry-monthly-value'),
                }
            }
        },
        cwl: {
            hitsPerSeasonInput: document.getElementById('inc-cwl-hits-per-season-input'),
            oresPerAttack: {
                shinyInput: document.getElementById('inc-cwl-shiny-bonus-input'),
                glowyInput: document.getElementById('inc-cwl-glowy-bonus-input'),
                starryInput: document.getElementById('inc-cwl-starry-bonus-input'),
            },
            warResults: {
                winRateInput: document.getElementById('inc-cwl-win-rate-input'),
                drawRateInput: document.getElementById('inc-cwl-draw-rate-input'),
                lossRateValue: document.getElementById('inc-cwl-loss-rate-value'),
            },
             display: {
                perHit: {
                    shiny: document.getElementById('inc-cwl-shiny-perHit-value'),
                    glowy: document.getElementById('inc-cwl-glowy-perHit-value'),
                    starry: document.getElementById('inc-cwl-starry-perHit-value'),
                },
                monthly: {
                    shiny: document.getElementById('inc-cwl-shiny-monthly-value'),
                    glowy: document.getElementById('inc-cwl-glowy-monthly-value'),
                    starry: document.getElementById('inc-cwl-starry-monthly-value'),
                }
            }
        },
        championship: {
            supercellEvents: document.getElementById('inc-championship-supercell-events-select'),
            display: {
                perEvent: {
                    shiny: document.getElementById('inc-championship-shiny-perEvent-value'),
                    glowy: document.getElementById('inc-championship-glowy-perEvent-value'),
                    starry: document.getElementById('inc-championship-starry-perEvent-value'),
                },
                monthly: {
                    shiny: document.getElementById('inc-championship-shiny-monthly-value'),
                    glowy: document.getElementById('inc-championship-glowy-monthly-value'),
                    starry: document.getElementById('inc-championship-starry-monthly-value'),
                }
            }
        },
    };
}