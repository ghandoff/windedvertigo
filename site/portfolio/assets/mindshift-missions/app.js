// Application Data
const scenarioData = {
    scenarios: {
        plastic_packaging: {
            title: "Plastic Packaging U-Turn",
            brief: "You're working at a global food company under public pressure to reduce plastic packaging. A new compostable material exists, but it's 30% more expensive and untested at scale. You're the Sustainability Lead.",
            constraint: "Cost ceiling + public trust at risk",
            checkpoints: {
                1: {
                    title: "Government Regulation Surprise",
                    info: "A new regulation bans plastic bags within 6 months—sooner than expected.",
                    questions: [
                        "How might we build public trust while testing new solutions?",
                        "What's the quickest way to prototype a packaging solution?",
                        "Who do we need to bring in early to reduce resistance?"
                    ],
                    actions: [
                        "Run a fast public pilot of the compostable material in 3 regions",
                        "Delay the transition and lobby for a 12-month extension",
                        "Launch a co-design sprint with suppliers, retailers, and a youth climate group"
                    ]
                },
                2: {
                    title: "Backlash on Social Media",
                    info: "Your pilot was leaked. Influencers call it 'greenwashing.'",
                    questions: [
                        "What does this response reveal about deeper public concerns?",
                        "How can we shift the narrative through transparency?",
                        "What evidence do we need to build legitimacy now?"
                    ],
                    actions: [
                        "Publish internal testing results and next steps openly",
                        "Invite critics to a feedback session and redesign the rollout",
                        "Replace the pilot with a totally new circular packaging strategy"
                    ]
                }
            },
            outcomes: {
                environmental: "Compostable rollout reduces plastic use by 40%",
                public_perception: "Mixed trust—improved by transparency efforts",
                operational: "Medium risk: supply chain needs 2 months extra"
            },
            reflection_prompts: [
                "What was your most powerful question, and why?",
                "How did your perspective shift from Checkpoint 1 to 2?"
            ],
            scaffold: "Initially, I focused on ___. But as the situation evolved, I realized ___."
        },
        edtech_rollout: {
            title: "Equity in EdTech Rollout",
            brief: "You're rolling out a new EdTech product in a low-income school district. Early feedback shows it benefits high performers and widens gaps. You're the Innovation Officer.",
            constraint: "Limited training time + political pressure to scale fast",
            checkpoints: {
                1: {
                    title: "Board Pushes for Expansion",
                    info: "School board wants expansion to 30 more schools in 3 months—despite inconsistent usage data.",
                    questions: [
                        "Where are we overlooking student voices in this rollout?",
                        "What would equitable implementation look like?",
                        "What conditions must be in place before scaling?"
                    ],
                    actions: [
                        "Slow down and conduct rapid user research with diverse students",
                        "Scale now, but offer optional teacher micro-trainings",
                        "Pause rollout and redesign based on an equity audit"
                    ]
                },
                2: {
                    title: "Teachers Push Back",
                    info: "Teachers in 10 schools resist the tool and refuse to use it.",
                    questions: [
                        "How can we reframe the tool as supporting—not replacing—teachers?",
                        "What concerns are really behind this resistance?",
                        "How can we turn teachers into co-designers of the tool?"
                    ],
                    actions: [
                        "Host listening circles with teacher leaders",
                        "Reframe the tool publicly as teacher-centered",
                        "Offer mini-grants to teachers to build their own learning challenges using the tool"
                    ]
                }
            },
            outcomes: {
                learning_equity: "Mixed; improved where teachers had input",
                public_perception: "Trust up among educators, uncertain in media",
                operational: "Delays in expansion, but improved design model"
            },
            reflection_prompts: [
                "How did 'asking AI' help you adapt or respond to the situation?",
                "How did your perspective shift from Checkpoint 1 to 2?"
            ],
            scaffold: "I assumed ___. Now I see that asking ___ might have led to better outcomes."
        }
    },
    roles: ["CEO", "Innovation Officer", "Sustainability Lead"],
    badges: ["Curiosity Explorer", "Adaptability Ace", "Systems Thinker", "Inquiry Master"]
};

// Application State
let gameState = {
    teamMembers: '',
    selectedRole: null,
    selectedScenario: null,
    currentCheckpoint: 1,
    startTime: null,
    screenTimes: {},
    responses: {
        checkpoint1: {
            question: null,
            action: null,
            groupDiscussion: '',
            actionExplanation: '',
            aiAdvice: ''
        },
        checkpoint2: {
            question: null,
            action: null,
            groupDiscussion: '',
            actionExplanation: '',
            aiAdvice: ''
        },
        reflection: {
            answer1: '',
            answer2: ''
        }
    },
    earnedBadges: []
};

// Screen Management
const screens = {
    welcome: 0,
    roleSelection: 1,
    scenarioSelection: 2,
    missionBrief: 3,
    checkpoint1: 4,
    checkpoint2: 5,
    outcome: 6,
    reflection: 7,
    summary: 8
};

let currentScreen = 'welcome';
let currentScreenStartTime = Date.now();

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    gameState.startTime = Date.now();
    setupEventListeners();
    updateProgress();
    startTimeTracking();
});

function setupEventListeners() {
    // Team members validation on welcome screen
    const teamInput = document.getElementById('teamMembers');
    if (teamInput) {
        teamInput.addEventListener('input', function() {
            const hasContent = this.value.trim().length > 0;
            document.getElementById('startMission').disabled = !hasContent;
        });
    }

    // Role selection
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', function() {
            selectRole(this.dataset.role);
        });
    });

    // Scenario selection
    document.querySelectorAll('.scenario-card').forEach(card => {
        card.addEventListener('click', function() {
            selectScenario(this.dataset.scenario);
        });
    });

    // Form validation
    document.addEventListener('input', validateCurrentScreen);
    document.addEventListener('change', validateCurrentScreen);
}

function selectRole(role) {
    gameState.selectedRole = role;
    
    // Update UI
    document.querySelectorAll('.role-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-role="${role}"]`).classList.add('selected');
    
    // Enable continue button
    document.getElementById('continueToScenario').disabled = false;
}

function selectScenario(scenario) {
    gameState.selectedScenario = scenario;
    
    // Update UI
    document.querySelectorAll('.scenario-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-scenario="${scenario}"]`).classList.add('selected');
    
    // Enable continue button
    document.getElementById('continueToMission').disabled = false;
}

function showScreen(screenId) {
    // Track time spent on current screen
    if (currentScreen) {
        const timeSpent = Date.now() - currentScreenStartTime;
        gameState.screenTimes[currentScreen] = timeSpent;
    }
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    document.getElementById(screenId).classList.add('active');
    document.getElementById(screenId).classList.add('fade-in');
    
    currentScreen = screenId;
    currentScreenStartTime = Date.now();
    updateProgress();
    
    // Auto-scroll to top
    window.scrollTo(0, 0);
}

function showRoleSelection() {
    // Save team members from welcome screen
    const teamInput = document.getElementById('teamMembers');
    if (teamInput) {
        gameState.teamMembers = teamInput.value.trim();
    }
    showScreen('roleSelection');
}

function showScenarioSelection() {
    showScreen('scenarioSelection');
}

function showMissionBrief() {
    // Populate mission brief
    document.getElementById('selectedRole').textContent = gameState.selectedRole;
    document.getElementById('selectedScenario').textContent = scenarioData.scenarios[gameState.selectedScenario].title;
    document.getElementById('scenarioBrief').textContent = scenarioData.scenarios[gameState.selectedScenario].brief;
    document.getElementById('scenarioConstraint').textContent = scenarioData.scenarios[gameState.selectedScenario].constraint;
    
    showScreen('missionBrief');
}

function showCheckpoint(checkpointNumber) {
    gameState.currentCheckpoint = checkpointNumber;
    const scenario = scenarioData.scenarios[gameState.selectedScenario];
    const checkpoint = scenario.checkpoints[checkpointNumber];
    
    // Update checkpoint content
    document.getElementById('checkpointTitle').textContent = `checkpoint ${checkpointNumber}`;
    document.getElementById('checkpointSituation').textContent = checkpoint.title;
    document.getElementById('checkpointDetails').textContent = checkpoint.info;
    
    // Populate questions
    const questionsContainer = document.getElementById('questionsContainer');
    questionsContainer.innerHTML = '';
    checkpoint.questions.forEach((question, index) => {
        const questionElement = createChoiceElement(question, 'question', index);
        questionsContainer.appendChild(questionElement);
    });
    
    // Populate actions
    const actionsContainer = document.getElementById('actionsContainer');
    actionsContainer.innerHTML = '';
    checkpoint.actions.forEach((action, index) => {
        const actionElement = createChoiceElement(action, 'action', index);
        actionsContainer.appendChild(actionElement);
    });
    
    // Clear form fields
    document.getElementById('groupDiscussion').value = '';
    document.getElementById('actionExplanation').value = '';
    document.getElementById('aiAdvice').value = '';
    
    // Disable continue button
    document.getElementById('continueCheckpoint').disabled = true;
    
    showScreen('checkpoint');
}

function createChoiceElement(text, type, index) {
    const element = document.createElement('div');
    element.className = 'choice-option';
    element.dataset.type = type;
    element.dataset.index = index;
    element.setAttribute('role', 'radio');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', text);
    element.innerHTML = `<div class="choice-option-text">${text}</div>`;
    
    element.addEventListener('click', function() {
        // Remove selection from siblings
        this.parentNode.querySelectorAll('.choice-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Select this option
        this.classList.add('selected');
        
        // Store selection
        const checkpointKey = `checkpoint${gameState.currentCheckpoint}`;
        gameState.responses[checkpointKey][type] = index;
        
        validateCurrentScreen();
    });
    
    return element;
}

function continueFromCheckpoint() {
    // Save text responses
    const checkpointKey = `checkpoint${gameState.currentCheckpoint}`;
    gameState.responses[checkpointKey].groupDiscussion = document.getElementById('groupDiscussion').value;
    gameState.responses[checkpointKey].actionExplanation = document.getElementById('actionExplanation').value;
    gameState.responses[checkpointKey].aiAdvice = document.getElementById('aiAdvice').value;
    
    if (gameState.currentCheckpoint === 1) {
        showCheckpoint(2);
    } else {
        showOutcome();
    }
}

function showOutcome() {
    const scenario = scenarioData.scenarios[gameState.selectedScenario];
    const outcomes = scenario.outcomes;

    // Set outcome category based on scenario
    if (gameState.selectedScenario === 'plastic_packaging') {
        document.getElementById('outcomeCategory1').textContent = 'environmental';
        document.getElementById('outcomeResult1').textContent = outcomes.environmental;
    } else {
        document.getElementById('outcomeCategory1').textContent = 'learning equity';
        document.getElementById('outcomeResult1').textContent = outcomes.learning_equity;
    }

    document.getElementById('outcomeResult2').textContent = outcomes.public_perception;
    document.getElementById('outcomeResult3').textContent = outcomes.operational;

    showScreen('outcome');
}

function showReflection() {
    const scenario = scenarioData.scenarios[gameState.selectedScenario];
    
    // Set reflection prompts
    document.getElementById('reflectionPrompt1').textContent = scenario.reflection_prompts[0];
    document.getElementById('reflectionPrompt2').textContent = scenario.reflection_prompts[1];
    document.getElementById('scaffoldHelper').textContent = scenario.scaffold;
    
    // Clear fields
    document.getElementById('reflectionAnswer1').value = '';
    document.getElementById('reflectionAnswer2').value = '';
    
    showScreen('reflection');
}

function showSummary() {
    // Save reflection responses
    gameState.responses.reflection.answer1 = document.getElementById('reflectionAnswer1').value;
    gameState.responses.reflection.answer2 = document.getElementById('reflectionAnswer2').value;
    
    // Calculate badges
    calculateBadges();
    
    // Populate summary
    populateSummary();
    
    showScreen('summary');
}

function populateSummary() {
    const scenario = scenarioData.scenarios[gameState.selectedScenario];
    
    // Overview
    const teamNames = gameState.teamMembers
        .split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);

    const teamChipsHTML = teamNames.length > 0
        ? `<div class="team-chips">${teamNames.map(n => `<span class="team-chip">${escapeHTML(n)}</span>`).join('')}</div>`
        : '<div class="summary-value">none listed</div>';

    document.getElementById('summaryOverview').innerHTML = `
        <div class="summary-item">
            <div class="summary-label">team members:</div>
            ${teamChipsHTML}
        </div>
        <div class="summary-item">
            <div class="summary-label">role:</div>
            <div class="summary-value">${gameState.selectedRole}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">scenario:</div>
            <div class="summary-value">${scenario.title}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">total time:</div>
            <div class="summary-value">${formatTime(Date.now() - gameState.startTime)}</div>
        </div>
    `;
    
    // Checkpoint 1
    document.getElementById('summaryCheckpoint1').innerHTML = createCheckpointSummary(1);
    
    // Checkpoint 2
    document.getElementById('summaryCheckpoint2').innerHTML = createCheckpointSummary(2);
    
    // Outcome snapshot
    const outcomes = scenario.outcomes;
    let outcomeHTML = '';
    if (gameState.selectedScenario === 'plastic_packaging') {
        outcomeHTML += `
            <div class="summary-item">
                <div class="summary-label">environmental:</div>
                <div class="summary-value">${escapeHTML(outcomes.environmental)}</div>
            </div>`;
    } else {
        outcomeHTML += `
            <div class="summary-item">
                <div class="summary-label">learning equity:</div>
                <div class="summary-value">${escapeHTML(outcomes.learning_equity)}</div>
            </div>`;
    }
    outcomeHTML += `
        <div class="summary-item">
            <div class="summary-label">public perception:</div>
            <div class="summary-value">${escapeHTML(outcomes.public_perception)}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">operational:</div>
            <div class="summary-value">${escapeHTML(outcomes.operational)}</div>
        </div>`;
    document.getElementById('summaryOutcome').innerHTML = outcomeHTML;

    // Reflections
    document.getElementById('summaryReflections').innerHTML = `
        <div class="summary-item">
            <div class="summary-label">${escapeHTML(scenario.reflection_prompts[0])}</div>
            <div class="summary-value">${escapeHTML(gameState.responses.reflection.answer1 || 'no response provided')}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">${escapeHTML(scenario.reflection_prompts[1])}</div>
            <div class="summary-value">${escapeHTML(gameState.responses.reflection.answer2 || 'no response provided')}</div>
        </div>
    `;

    // Badges
    const badgesContainer = document.getElementById('badgesContainer');
    badgesContainer.innerHTML = '';
    gameState.earnedBadges.forEach(badge => {
        const badgeElement = document.createElement('div');
        badgeElement.className = 'badge';
        badgeElement.innerHTML = `${badge}`;
        badgesContainer.appendChild(badgeElement);
    });
}

function createCheckpointSummary(checkpointNumber) {
    const scenario = scenarioData.scenarios[gameState.selectedScenario];
    const checkpoint = scenario.checkpoints[checkpointNumber];
    const responses = gameState.responses[`checkpoint${checkpointNumber}`];
    
    return `
        <div class="summary-item">
            <div class="summary-label">situation:</div>
            <div class="summary-value">${checkpoint.title}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">question selected:</div>
            <div class="summary-value">${checkpoint.questions[responses.question] || 'none selected'}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">action selected:</div>
            <div class="summary-value">${checkpoint.actions[responses.action] || 'none selected'}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">group discussion:</div>
            <div class="summary-value">${escapeHTML(responses.groupDiscussion || 'no response provided')}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">action explanation:</div>
            <div class="summary-value">${escapeHTML(responses.actionExplanation || 'no response provided')}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">ai advice:</div>
            <div class="summary-value">${escapeHTML(responses.aiAdvice || 'no response provided')}</div>
        </div>
    `;
}

function calculateBadges() {
    gameState.earnedBadges = [];
    
    // Curiosity Explorer - for engaging with AI advice
    if (gameState.responses.checkpoint1.aiAdvice.length > 50 || 
        gameState.responses.checkpoint2.aiAdvice.length > 50) {
        gameState.earnedBadges.push('Curiosity Explorer');
    }
    
    // Adaptability Ace - for providing thoughtful explanations
    if (gameState.responses.checkpoint1.actionExplanation.length > 50 && 
        gameState.responses.checkpoint2.actionExplanation.length > 50) {
        gameState.earnedBadges.push('Adaptability Ace');
    }
    
    // Systems Thinker - for thorough group discussions
    if (gameState.responses.checkpoint1.groupDiscussion.length > 50 && 
        gameState.responses.checkpoint2.groupDiscussion.length > 50) {
        gameState.earnedBadges.push('Systems Thinker');
    }
    
    // Inquiry Master - for completing both reflection prompts
    if (gameState.responses.reflection.answer1.length > 20 && 
        gameState.responses.reflection.answer2.length > 20) {
        gameState.earnedBadges.push('Inquiry Master');
    }
}

function validateCurrentScreen() {
    let isValid = false;
    
    switch (currentScreen) {
        case 'checkpoint':
            const checkpointKey = `checkpoint${gameState.currentCheckpoint}`;
            const responses = gameState.responses[checkpointKey];
            
            isValid = responses.question !== null && 
                     responses.action !== null &&
                     document.getElementById('groupDiscussion').value.trim().length > 0 &&
                     document.getElementById('actionExplanation').value.trim().length > 0 &&
                     document.getElementById('aiAdvice').value.trim().length > 0;
            
            document.getElementById('continueCheckpoint').disabled = !isValid;
            break;
    }
}

function updateProgress() {
    const progressSteps = {
        welcome: 0,
        roleSelection: 12.5,
        scenarioSelection: 25,
        missionBrief: 37.5,
        checkpoint: 50 + (gameState.currentCheckpoint - 1) * 12.5,
        outcome: 75,
        reflection: 87.5,
        summary: 100
    };
    
    const progressTexts = {
        welcome: 'welcome',
        roleSelection: 'role selection',
        scenarioSelection: 'scenario selection',
        missionBrief: 'mission brief',
        checkpoint: `checkpoint ${gameState.currentCheckpoint}`,
        outcome: 'outcome',
        reflection: 'reflection',
        summary: 'summary'
    };
    
    const progress = progressSteps[currentScreen] || 0;
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = progressTexts[currentScreen] || 'loading...';
}

// Logo assets for PDF export (base64 PNG, white on transparent)
const PRME_LOGO_B64 = 'data:image/png;base64,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';
const WV_LOGO_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABUCAYAAAAFzDwiAAAloUlEQVR42u19eYxdWXrX725vX1yLy+W2XT3tbnebVkSDG4lIaKgZITFEQYwTeEEgRAhBCMQShBSEhESrhRTEIiH4j8miERJDRCkzbyCJkkhDpqaRMlu/THoSp7217eelql6tb3/vrvxxz7n3bHd5brftYXylku3yu+8u53e+7/f9vu98R8OL43k6NAAaWi1ts9fT6C+319YCbG15WeduXLm6AuAsgA0AFwG8Sv48D2ANQANAGYAJwAMwBXAM4B6ADwC8B+Ab3U77UfStrZaR49of64FfHM/4aLVaxtbWlg8gSPvcxpWrNQCnAbxEQPYpAK+Qv1OQLRGAPe5xAOB3AXyx22n/Zvird3TgXQDwXwDwB8WK4R2gdS1+v1tvBmQQgySgvbz506Vg2F9lrNinmJ8LANYBrOQAWCCARWN+VJ+lPxoAnfm/bwH4hW6n/b8AYHNz09ze3nZfAPCZA+wdDa1rvJvc/owPvJvXQmhvv/22WavVgu3tbXfjytV/AuCnCMjWiJtMO3wByCLAPs64UvCyYPwqgJ/vdto3iUvOtNYvAPix38k7Wqt1TesRkBEelsdNNgA0Cd+qAigQvjUG0Adw2O20R8znfxnA300AwcIA6+98CLNYhW4WYFhlGGYBumFB0w012oIAvmfDnY0xHx+hceY1FdANcu//ottpf4Fxy/4LAH4MgAm8Rmu1WvpWBuHeuHK1KvCwV8jPy4SHrRLwlRSn2wAOAdwF8H8B7AH4jwBcAWSpADOsUvSjaTqsciOfaQv4uaNp8mUC38dstI9y4wz7a4+AEAD+G4B/1O20R0/CJWv/nwJMA94Ba8HW1taCra2tQCbS7xA3Q2Zzq2Vs3HbWCA+7wBB9ysPOEh5WyOnOggxQ+QLvwqB3G2ahDMMsQbeKMMwCNN1UAgYAfM+FbvC00LWnMAtlBEHoTdlz6e9EEAa+D03XI7BOjh+iunyefRaP8M/fB/A3up329Y8LQu0H1nqJHCyni2y1Wsa3bjunCIjG3U77IQC8+WarMCo5/wrAXyfWrZ6TKy3iJgPBtWmMZQn/w7Whm4UMCxaQs3lgDfZuonHmUvRvZzaEVaojCHxomh6d7zkzmIUyc94tVJZeglmokM8E0DSdAzKLbQLCQwB/s9tp/87HAaH2AwOwnCT//I+2yrrtLAM4w7jJDUaqOEvcZB3ADMDXEPrinwPwt4Wv8x6X6A/2bkHTjdCiBAEC30N97dVcL8Ge9FGoNBH4PqBpie6SWj/fteG5c/iujXKTc52Yj49QrC5zINQ0DfbkBIXKKe6zo4O7qK1+igM7ve5w/w7qp18RXbIP4B92O+0vPG5woj19gD2+9SIc7BQB0DoB1AXCvy4AOEeAtwygsmDkp5EXm8nDIpDt3kCpcQaabsCwitANK9fFfNeBPRugVFtJ/MxsdIhSbSUCDguK8WEXtdWXcz/ctL+HcvNMBD76p8K6hehybRhmgeOMmqZhNjxAqb7KUgcQ+vBvup32v2aohP8sAPixrRdxg8tEiniJAEy0XmsATi2ghQUZephPZnPA/n64/xF0w4JBuJimG8rBsqcDFJgggCf6gYJ/Bdy/PWeG8dEDMfoEAExOdlA5dVYKHtz5CFapvtDgjA/vo7pyQQKV7znKiSO77/BPZz6GVayK79gA8EvdTvvvh7/LHyFrCwIsidzntV51EkGeYazXBmO9qNBay2NIErQw5LFg/Z0P0Tx7WbSA0gCIHEzlCqf9XZSb62rC73twnRk0aNB0HYZVYoAacy1hYBm3eA+11Zdl4PgudH2xhMdg7xYaZ16TvosNPjj3PTpEkbHC9PkVoKW88H+T4GScN4WnSRHhY7rHzc1N885waYkA7KzCer3EuEcrJ8DS1PyFrLc96cMq1QBNjwDiuzZGB/fQWL+U4Lp4YNEBG/ZuS3xufNhFdWVDslaB70oWhlo2NiKl90QtFe/qb6KxfkkGDuOeF1KaGVfM8rz+znU0z76RaIVZ9624NgXh7wH4fLfT3s8DQi2vqEjI/QoB0TnCu6j1Ok+s1yoRYbGge9RSXGQGv9mFZpihZEFEV8+ZwizIFDCSJgi5py9eZe0iYB3dR3VZdl3jowesRJFhYTylEOzaEybyjD9vT/solJsK4PDRLP38YPcGGuuvLwRCakHF7xKCDS44UemI9JkFEP4xgB/vdtp3siJkmm7xiYt8jViqc4z1ou5xjbjH8tOwXoO9WyGxN4soN9ZSAVhurkuzO0nOoJxNpYXNBj2UFNca9G6jsfaqNFjTQU95b4kWZvcGmgJQZsN9lOqnOYlF0/TE+6ean3gv1FUvcnjuHIZZlKzb5PghKkvneMpC7l0FQmr9BRB2AfxYt9O+lgZCjQDvRwH8ZwB/KofAmofcLxzcJM16drYuzm3Ulmc2OkCptipZFHrO6LArWQEZWCFQ5uNjFKtLuS0MK3VEFuawi5rgvul1Brs3JLfoOTMYVkkCzmx0iMBzSeAUp+CorKM63PkYZrEqBRt0YqRZYfbagiGgMs0ugM91O+0PSMWP5I61jStX30BY9dB8EuQeAIa92zAsouIbRehmAfa0n2rJZP2LXi7gHvjxuA0XcCgjTPZlJgiwSmBpmgZnNgr5pWhhnDkMS2VhHqGy9JIk6TQSLMzo8B5qKy8LUWp4TREQSYChQFO/91ATFEGYBFzWCrN8kE5sAYQ9AJ/tdtrXVJxQ27hy9RcB/D0ATs7gIBV4aWKrKFkoXepgD+XGGQkYaQEADxAPum4ouM1HqJ++mMptVOClQm6aTqZpWmSVJDmDRLdP2MKQewutr4obqsTrtKAlpgL8fSYBV55cvsojUBB2Afy5bqf9gKV8VET8E4yWg/7OdUwHPczHR3DnE/iewz3YdNBLHHwKDN9zEQQBAt8P/wwCBIGPQrkBz5mlArDcOIPR4b3o5bEzOwgC1NdexfjofuL5um7Ac21Je6ufvojx8UPus7XVT2Gwe0O6Fh34IAhIFiHA+OhBdJ5hFuDaE+48wyrB92SaYxWrsCcn3KAGgY9S/TTsSV/mRJoO33OkiLPcXMd8fMR9tlhdwnSwxwGW/Ql8H649hTMfYzY8wPRkF/3d68r3VqqfxuT4IQPk8PpmsQrPtaXPG1YR7nzM3Gf4XMXqEuzJSfQxwgk3AHzltdf+UhGtFudFdQC3WVQ2z76BQrmJYnUZZrES8ohoQHyUG2vSi5BAYJjwXTvSlsIXoscD5afLQ7WVl9Hfvc6Bgf17dfkCpoO9xPMNswB3TgESD2J16RxmwgSKo0fZfbPXri6fh+fOMdi9CQAwCxXY0350jSAIpOCAHoXKKcwG+wIIAxQqTbj2RPH+LHjOTDG4y3BmI2nCjo/uc5OGnfRmoQyrWEWpvorK0ktorr+R+N4qS+cw3L8jTV7DLCjHzCxW4cxG0n0WKqdYEJrEu/4Zu1H6d9ja8lqtls4C8D8BmJMP+hTd8/Exo1OxICIvYjpIBZFhFeHMhtHgsy5OJ4FB0mwEEL0o33clYIQT4Ux0j6rDLFZgT/qy5WmssS8n0fKIwUAI7CIa65fgzIYhsMrNyAKJWZDB3k3ewjROY8xZmPDzZqGSYGFK3Puj51mlmuRFqssXMOzdllyubpjw/cVqBOqnX0F/J5789D5FWhNZeHI/KhAyk52uQfmnG1euvhUGI2EVkt7ttL8H4K8iXKCikw+iWF3CbHgQfSE7UEEQwCo3lLOXv7k68x08zwqCAM31NzA67KZbU93kHjC+h9DcixaBtzxNzIb7EggLlVNw5uNMyxOBKggwG/Si56Wa4bS/G1KGg7vSgDXOXJKerbp0DsP9j5QWJlBYGKtUx3x8xNy/FnkREbQsL+aBY0aBWN6DRt2B73PfxXJ9cbLwkzae7GQiaky26R+HiYuvhwBstVpGt9P+DQCfQ1hiY1AQluqrmJzsKMXPePbOUx+mVF/F+PgBBzz2oWorG6m8kj6gPR0I1jTZIsjc5hHDk8h5xSo8Z55geUbctaBpMEt1mIUKRgf3YvfXXIfvOfBcG6ODuxwHjJ6tvytYmIvo73woATapYrlYXZZ4XuQWFZwzTNN53HcHQYDm2csY7n+0WHJfD/VIiU8reXggKXxBELCSE3W7n0arZRBdMPxmKhRuXLn6IwB+nWQ5qKAo6VQiaVcVRCZpdXJgkR7yp4m2LEfLugeq8OfNqbJlTDRVxuZMxXKmkA/qJIEvRIYkpypFvESnlCJ2Varv+CGqS+ek6JhG/XkrWsbHD1BdOr8QEOPiVv7aznwMTdMluUoU1YV8+y6A17qd9hhA+L/b29vu5uam2e20/xDAn0e4RtQkIERtZSOsbxPMccTpDJNz06ojAp/vK91pSMinGdb0NMZHD6QJkBYAcNxmV8Vt1OcVq8uY9nl+R8HX370RgY9a30K5GblmLarhI1ShtqLkzJpupFiYB5L7ps/OPbduKC1hciB2XgrEeENxExNBLTALZTiMB6LXtorVCJjsTxyJ67CnfdFE9ruvWjMaCUfw3N7edhG64y6AzwL4BhPBRABio0OepGu5uIam65FMwoMwgFkoK18mT7jPS5NBDBzEAEAMbJK4zWDvFh9hNuMIk3Nn669HADGsEkaH3YjD0c+IfCjkzPIE080CXHvKgJYAZfm8RE2qy+cJp9WkyaeiIepALECpsQZnPoY9OYHnzDj+2ThzKUrDDffvxHy03MB8dCjFBCwmYmz4cGZDDHq32ewWPelXsbXlbW5uGgACWTonavXLL2+WgpWl/wHgKuuOowHUdYnPRQlqkjtNO0QlXwRTVtYjSbSNswchbUgUrElJkeSiVNUoCbng2WAfpcZpiSKI74OnK+r6OzZHzQJGlepj753LRPAFoykic6AUqUMbRYyJFk4etnJHrOTxfRe+68B35/CcOVx7okxhMgDUALQdzf1bO+//+kwNQL46hmZKfpaA0KCmTnwJ4kvPAgAAzEdHKNaWlVW/eQComgzs+arsQR5uQyuIHzcX7MxHsIo1pZCeVn8nVkFHRaBMqm+wexP1tYtcWZl4HdVB0395VsaxaUcEAcaH3dzLCXIUqegAfqPbaf8VtFqaOvTCNpkG72j9nf/61ebZyxUAn2ZQrGm6Ac+ZcSBk3XOxcgqTk0eplbtmoYzJySMy82XgheU+N5UEXi460AXB2g9ljNGRMqdLZRdnOiQppXjQqfwhnheTfp3nR7MRDKZyxTALGPRuwyrVOf0sAjnlkjvXOYtlFiqYnOxE7yMW74vRd5TqK9AY8PGEPxlMVrmO4f4dFKtLPA/2HLj2FO5sCHt8jOlwP0o9apoOTTekVGSeo797A+5siNnokD1fI5TucvPs5Z3+1778nSwzo6HV0rG15W1cufrzAP49+LUA0WwX84xZOU8+Qg3ztIn5X0WNWloOWIyw0+r9VJY46zy2jCkrF8wXn8rWR11/J1dBMy82KtQQAZfkgiVwKIozntSRVJjBVAFR/Nz1C9aP5PFz2ubmpkFkmp8B8MsEydF6VrGaQgRhUskSP2Ouo7n+RiIIaWFoKgiFKg3WNSVVt0Q57qj6mXfHScCKy5jie0yTgliZSeSSqvq7PEWmQRDAc6ZwpoNUqvE0Dhb8WetiGEnmc0aeL793756/ublpfvDN3+40z17+HoDPI245oRtWCbPhAVP1wUd0ZqECZzaEYRaTJZa4jEeR/w2zF5OTnVRLpulhOo21hLFwa4WptgTB1yrVMDrsolg5xb1A3VCfp5sF2JMTAuogKoRI4mKGVUJ/58PQLRv8IvMCiTDZKm5KO3zPge978OwJnNkQ8/ERZoMeirVlaJoG3bCUFudxj+mgB92wOG3RmfMUQzW5qAdRRcf0/cyH+7SyhlK5uwsVjjKC9acBtBGu74jaNojrB0SCnGWF0qPs/C6dVhMrA4CMdRSJxa0J5/HieCwrqaqfI1H58D4qy+cijud7DhD4mJzsZFKNT+oQBeq8q+fiMU9+r9H4x6VdFDP/faEVLYxg/R6AzyCs86IlN6icOovRYZdLu/Gpu7Iy8a62ZK5SsC7VT6cWIVDrJGuNgl65eyNVMBcllPi86wllTBoJDnSiOb4ulX9Fet7KhehzmqbBMAswrNInAr5pfxf25ASuPSVlZfcV0fcBqkvnOTGZ13x96IYl6aR0zNnlDTSLRMeZA7LsfarGog/EuOPd5tnLXwHwFxCugnMB6IVKE4PebZRqy5IppqJpWOGi5xKsWU7HufTpAIZVTCliMOA5c+l8Nkc9OrgrdQfgZ70LXTe4c0u1VUyOH3INgaxyA8P9O9ANE850gPn4CNP+3lOxZoO9W/CcKZFMfGi6gdHBvahWsNxcD6vTSVmduOxhcvxQufJPGVEHPlecShUEltppmgazUJbSg+E6nTld5xKQ+KHz+AvTiWBN2sJ+hcg0nGCt0qjyusIo4hTWPySY9IXPjwKAk0eonHop9XzdLIZczLXhuTMEnvtUSX9/53rYrKhQIV2x8nVhcGZDmMUa2GXPSWX7bKAgLohKa+eRpbuy/8/kxKkL/rf6Y7+VrS2PpO4O/cLu5xA2MYzyxxyfS03dXU+9jGGVuMpbzqUXq5kV1oZVilJdKtdSOfUSZqOD1POpm7RKNZRqq08NfPR+m2ffQHVlA6X6KqxSLQKfXIAacGk1o1AmoNIiCyRKJrE8F35ff+c6dLMQ5YNZF8oGGZPjRxzvDVOX65yqwQe97PUif/3BE2jNwWVNfglhs8WFsibD3kehup9yiKkqLr3lOtDNdIvArsEVW5WFSfPs9SpPxJrtXodZqISKgG4g8Fw4swHX1YpmPMLF6Dy/EpUCUdnw7AnnFRIskPL/VXIQ7y1iTTNe66L2aKpFX4IEMwfwlv7xX+m7VA/Uup32zwL4D4irqwMqZchFpew6j4sYH95PvUqh3MB8fMwlwyNeaVqZZf5moSJZUja4KeQosH2cY7h/B55rR/fcXH8D1eULKDXWUKqtoNw8g8aZS1JtolmqKYVrlp/xRQA6URomETeMxzuIXDIrt4gWjAVfXPcY/7/LFP+agjYqeiKailRMFvqXbm1m3TGelLcIaWHL+L2vffl3mmcvTwH8RebpNd0w4czHpEbNl1J3hUozU+czC2XMhvtM5oUJbnSd0yCTomNnNuJWc7Eyi0EqU/J2uRr2bsNz5nEFDwECG9zougGzWMl8fbph8dcOwvulwErqZurOx3CmfcxGh5j2d6Llm75nM/pgeD7L33TDjERzupCfjVID3+ckM03TOOspVrnb42PO8mqGwUX6NG3LJDDeu/XBl79kPMnZfu3aNZAI+b3m2cv3iWBNFzxpBiPeqgTrQrmB2fAgdcDMYhXT/i5X+MnyyqwiBsMswHPm0cvm7yEUrJOUfiAIiwBILrdYXYZVqodRn2FFg8JmfTRdp2WXzL3F9yqK5TH3LEYFs549DVONTPWOpmmYnjxCqb4Ks1hFodKU0nBUPGbr+GIAGRy4nNmQy/iEIrfJKQL0uYe9j8gz8gEImzOWADrtU6GdAvBL/Z0Pv6E/YY8TMFrhrwD4CQhrTQqVUylrTXyU6qvKRUPsUW6uc2X+smaXkTYa7HEKvYrzSJkaMtB0UJQBQBAAQjaAWjTebepKDhcEgbTeQtdNmMUq5sN9ySWKfI0DnyD4iy6enwyQ1tboxFOBPBdLT1jLSvkpWy0T12My7n86FAOQDiD0Jn5SBwPCr2KhtSbMoqGUxUYAUF0KCzZlEIYvLH2diZao1vuKNS6DvVvRMkc1QOMX7TJciI3w6XnOfITJ8UMpMqcWUU9IV1qRfpdvoomr2FxmEVZcbR2rEWKjJSqqa7oeSV6xFxL4ncC/YxrFADTURGnHfQfAH31iAFRkTT6LcDsoLmsyZrImIgitUo0jzUpL2FhTDARxwykDZHIzGAnSBP9CWTlDHQCQgWLu2SrLfNYq1lBZOhdmhQhYuWAgYWkDS0toaixNnE4LQCzh+cV3OOzdhj3pY3LyKLLIbFGqUeADEFcIQCSAxs9EL3Sv+6p1/xMFoADC7yNca/J9ViusrmwQS5gEwuwuoPJaXmKJ7HEqj0yIo5RrN0xV3xfXhj0dYDroYXRwV6mFpUSCUcpK5KxeArDE6m13nvx8MfAlCxQpAmlgrq+9ikKlicqpl5SFqKLncucjKVhMiJApEr9PFqgbnygAKQiFtSbvMTINKqfORhIKP0DhgE1OdtIBKC2tpC/8YmogIletUC4jnydKDq49gWEWUCg3UG6sSd2uYkvBB1Oie49dV+wKVUsZ+HU2gSSJyBMs0QIx/C4fmFWyUgq/i3K+Gd//XQDo9XraJw7AhKzJNuKm4HDJOlyV2MpaEaXA7EwzBNp8GQcacSoZo/BCs/gpK3WkDYRuFHLdN+8JCGdbSa6NNC3BAtmzDDAPc78rFb9jCzgy3L/OBiBra2vB0wEgAeHbb79tPfjmN6cAvoB4tTxzg/IAGMX08i0vWmkWV3EEKe0oeAIugHk+UWp9UqCRY8AGUbVNkBhpmhkWMqYA9YUmGC1lU7lINZg3cg8jp/WRJQrZ7v8ifRE6wq0x/jCExJtPEYAA3n//L9NtEP6IiYiYCEyTXnRWI+64K6iWqMrzM1gVgCTzP2VEl2OBTlwtE58ndjBlA4sgCJTdslScyk8paRv2PkoNQFg+mwfMLL8N9clSggFI4L2+FIDc6XbeekSzaE8VgMC7AYDAL1g3AOwgLu1PqCQOBLOe70hb4K7qHZ0kReSRHPJaCtVAx649jKZVK/EWDkAyJoxsde3I0s/Hx3DtCfeMIr8Vn0UMQAzR/ccUiSLxD4B3/VarZXziUbA61HxHf/DNrSmJiCOUUfcjBiJJcgbP4XxOWE4bIF0RgKRZAllymOZ6UDEAEa1yTNwDpVAccTaucFa2aLK7rqZOGBnMIYCqqy+jWF2CWahEEyMIAq73D58fTgpAePevaAL1Pg1AngUAo65IAL7DvlVnnkzsswIR0SUlFYKqujaw+6cp+ZQoOczyRYyiEOwxmYTB3i1Y5Tpn/SYJ1dMqzpbWjFx0keyEUYGZts6g0pdYEc26WFUGhN3iIsP9cwHI9tpa8EwAuEYuDODb7FsVLQJvTTICkch6aDkjOIXbVkS2KsnBnWdHwKpIkC4jGJDGQxw4nVliOZq1IGdLmzAqMFO5ihXTWW/C8UcxABHaqKgCECIr0QBkAuAaCUr9ZwJAsmUqEDZAmpNAJIitluwasyqnKc9QvZQsQVm0BE8kAFGcV6qvwpmP0Fh7VXL/qmWfSZPPT2mHp9To2AxIgjA+2L2B+egwoi5swTC7FFZME3pC+ZrEe2P3T8f8VrfT3mMVkKcOQEpGu5237gNgbXbY4UBZaMk3ykkLOtIi4LQARLVXmxxI+BgfPcC0vwd72ofn2picPMrkYUBYhBGWkQVc1iZpcVTsys0sTpVbo0sCc2P9dRRrK9KCMVU9In8vo3T3b6sCEASkMRGeFQARRkDv+gg3Po5uUB29aoKsIR8s5/NSggRVVXZaXpW+ULbdWnX5PMrNMyiUmzDMgjIgEIVgei2xBnE22E9cuhm68psLaZBZGp0ojIsAEt2978WAjLu9soL8MN39J2RAuHt6FgDsxXvRfZsXgtMCkWo+CSbBQqT1o046R8W5xPIrVdNvTWoRom645PvOwq48Ke2n1ugmqWAWI9g0uUeln7LPrnb/AxFn32MDkGcGQOYGvsveh61q4kgGTU/pqhAOpps6QOoAJFnWiAXY5G5SqowLnzmJz1Evc8zSEtNzulkThs28pJRIEYVAXkTEleAXxADEyeH+L7EByACkBIsGIM8MgMwNXANwQu4jSHJHefoF+m6GNVFKOTLRVr9QKBdsq7Q79ryI5O/djCJjvvQqHYEpVSWKCXMv1V1ngZnXWuUUnbhvnZgBEdsrM+6drg3qdDvtQ9Id/9laQHIDWrfTPo7CcsIDfaGjATsj0xYu+e48VaIwFAFImlURS7bY0nnPncOZDTHt7+SyWo0zl5RBTpCxsXiOqpIMje713GDOKh2TSuaY9SPj4wfScoHJ8SNurBGuHWd14GcKQDCR0HdZlKlXpmVnRMLFQU5KAGIqeVmSVRFdPi1UCNcIF2GV6tJSyhDoIg+bKURgZFrAgaIIwlkkABHkqCwwG8V8hRH0/ZnFKmbDA8zHx1FbD/r/rj2lwRXN948A/E8A2N7e9p4LADLHAoJ0JQWAM8ktRIPJVabwR9KgijPenhznehgxEqSuSKVlpllsNWdLrnGUJgwbgKgqepj/7+9cl+SePDWCpfoq2asuSKIOtPjkV7qd9i7J/wbPBQC3tz9D/c/vg9mrLq5zkwXptBZhnjNLjKL5yhQhAFEEPkrJIUcGRJk5IQCPW/IGuSygJYm6iwUg7LuI9c8YzFYplrVq3PYV6tKxJG4ubZ4dF47Q1W/HAH4BgMYkIZ4HC/huAACFwew2gAcsD0wLOpK68DfPvpFozdQl+FyklsKnZMlhIatFMidKC5gSBqdUleSbMIzEwjbNpO+1WF2KhGd2+WZSvjnaNsz3lcCj7ZQZrusRfP3zbqe9R/aH858jACJAq2XcuvVbc4RpuegN8ot1kqyZCoSXcwUgWQK0zKecXA+UKgRzANSojpMSgOgLZEAUE4bZ5DrwPaWeKW45SyN0VWBmlerRBpTitgx0GS0zmenWv7/Y7bS/mLRZ9TPngJuyIB1kC9KLdwNN6lya5GbYUnk2AMk6xHZxLCeNLaCWyQHjLbUeNwDhJ0y0q6fQ/4+WsXmuTfYA0cimja5SsdTNAob7H2FysoPJ8cNI3GY6LvgIF5xZALa6nbf+AULwJc4081kCkBGkv8NOCGc6IF1QA4gVLkZmmwshAIm2CGO/K/y7Mxsoe1ercp5Z24ipAhB3HjfsVhZUZK4BiZ89bd8V3Shwmyu68wl3v831NxK602pw5xOYxQqM2gpmpCBB2F6DvjgPgF4/fVFVNUy1PpOM4X/pdto/B7Q1bCFIk9yfbRTMV8bQDgpBXHGyeIl+nsGMeM6KXFcXdxCN31k1pQNBLATfla0Ww8NU+4KwbjLNouWqwo72LtGUHsQslDEbHcIjm8rY0z4Ge7e4ZQGl2goFH30Ij3lxtNuZT37vMeA0CPhuAPipEHzQEqWH50iG8YkgvQOATVZGOz6qBOlFSvTZyhSW/yUJ0GrALgp0uVgTCyxAZLc/DdtiJAcgdF11yM10+L4rtuzwKPkv1VZgmEUYVhGFcpMGDAFxm/THZx7CQNj38c8C+DUAfYIZgwHkAYDfAvAzjub+6W6nvYVYbslcnmg+YwCCbgGBsFL2T9Lw3bMn0KX8bb4Sfe4BLXUxq2tPlQUOhrBo23PmylbA4pZeKiGYjz4Xmet8N1PXniR2wnftMbfXiOAhInmL/N1XXMhQ4MBHuKvlVwD8y26nPQLw1zauXF0H8BqAFfKZHQAfdTvto+hM0jk39/jg+Tm+DeDvsGF/UgXzIoGIlhCAuLOhGoDiFqe6DntyEvZZJu3SeL1SLQR79gQ6E7FH1pxaNqjb5dL9UILAh0f2YSs31hKfr7H2GgTfz/5YAP4PgCqxYqpZ0AfwqwDuAxgST3QXwINupz2MQfVm0O28u0uAKRzv6JubX9e3t7e9RcD3XACQCUTeZ7hGKBAn9G42rHKu74733ZWDGXvaT221G1XhGBbXV49N4Yn986hbDwKygxQLQJ3sDZJRVEELIzRND7vn8+K7CDBqxXTO98fHdwD8ZLfz1nDjyh/8OMI+3nTp3yPidX6XUCD5CK2Zz4BKQ6ultyiFD3m8D7zrb29nJLZTbf2zPTQAwcaVqw0AtwGssohJ2nMkzzEd9KIGRmIRquoQN4VWSyXhrc3HRyiRho2jg3uormxw3yvuEzIbHcIwi3DtMTx7lrawKGDcIHtxI2O8RsQ63SPv8Vva4fGX7t3bnmW+qFbLoJLY9tpagK03A7qE9mkM/nNwhH2mN65c/TqATUKcDXbXb3HDmjz7x7HbaXHbb5HvFQ+6nVYS6FhrR/dzC61p2F/a9xx4rg3PmUXgzACZaM30jMBwBqCHcH+W28Rd3kK4tOHBK/XjfcKnpQnearWMXq+n0UVhtCiYFAcEz2rknwsOGPIH+MRlbLKCtGEuP3YgkuSq3dkIRm1ZEYCUEyxk/G/fd+E5DmfBaHNz3bDCrbNibhlkgExlAFwA+4ST3SEAu0FA1tXqx71722qr1mX4mAiurQW52Q8VAIVAJBoYZzokbV9lDpcnEGHTWbR7aQA9FKBVACRWMdw+y4bnzOHZU24jZl03oRfMPLzMSOBl1L0eIMyBU5d5g/zZBbBLIs/ER2MX9oRuk2YbHp+PPSv+9Ty54EsA/piRDhJ5WxYXjAOQ/EfK/m5pIEs7jgnZv8tYstsEdI+6nfYgbWxarZbe47jZVpBXX3sBwMcIRN5++21rP7jwIYCLVA9U7pMRBKQjffLt0z2APWceqv+CJVsAZHrGe+oTPaxL3CTlZXcIyA6f1wDgBQDlkN/buHL11wD8JOFCJt1gRhm1Hj1QNhTKQf7FCDOL/E9IhNll3CUF2cNup72fCpgfcpD9QHDAzV5P24554E/Q3zuzYbhXmzNjLNkUjTOvJYEvT4Spcp02iTDvCxHmbQAPTmtrvfff/4KTRiMo+V9bWwu2WJBtbXnbeHE81wAUlmpS14dyI2xZpherYbqriicRYT5gIsybBGT3/YK1Rzp3ZUaYAsh+4Mj/CxeccC8bV642CWlvIt5zTsXL0o4DAA8V5L8LYCcrwvxhIP8vAJjOA38awBdTPukBOCIRJpUxbjER5k630+6nPnerpW++ANkLAKZIMp8H8M8AXCBu8yaADwFcJ9Hm/W6nfZA3wpR42YvjuTj+H2M2CX/hq9TaAAAAAElFTkSuQmCC';


function copyToClipboard() {
    const summary = generateTextSummary();
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summary).then(() => {
            showStatusMessage('summary copied to clipboard!', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(summary);
        });
    } else {
        fallbackCopyToClipboard(summary);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showStatusMessage('summary copied to clipboard!', 'success');
    } catch (err) {
        showStatusMessage('failed to copy to clipboard', 'error');
    }
    
    document.body.removeChild(textArea);
}

function generateTextSummary() {
    const scenario = scenarioData.scenarios[gameState.selectedScenario];
    const outcomes = scenario.outcomes;
    const outcomeKey1 = gameState.selectedScenario === 'plastic_packaging' ? 'environmental' : 'learning equity';
    const outcomeVal1 = gameState.selectedScenario === 'plastic_packaging' ? outcomes.environmental : outcomes.learning_equity;
    const teamNames = gameState.teamMembers
        .split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);
    const teamBlock = teamNames.length > 0
        ? teamNames.map(n => `  · ${n}`).join('\n')
        : '  none listed';

    return `
mindshift mission summary
PRME × winded.vertigo
========================
team:
${teamBlock}
role: ${gameState.selectedRole}
scenario: ${scenario.title}
total time: ${formatTime(Date.now() - gameState.startTime)}

outcome snapshot:
- ${outcomeKey1}: ${outcomeVal1}
- public perception: ${outcomes.public_perception}
- operational: ${outcomes.operational}

checkpoint 1: ${scenario.checkpoints[1].title}
- question: ${scenario.checkpoints[1].questions[gameState.responses.checkpoint1.question] || 'none selected'}
- action: ${scenario.checkpoints[1].actions[gameState.responses.checkpoint1.action] || 'none selected'}
- group discussion: ${gameState.responses.checkpoint1.groupDiscussion}
- action explanation: ${gameState.responses.checkpoint1.actionExplanation}
- ai advice: ${gameState.responses.checkpoint1.aiAdvice}

checkpoint 2: ${scenario.checkpoints[2].title}
- question: ${scenario.checkpoints[2].questions[gameState.responses.checkpoint2.question] || 'none selected'}
- action: ${scenario.checkpoints[2].actions[gameState.responses.checkpoint2.action] || 'none selected'}
- group discussion: ${gameState.responses.checkpoint2.groupDiscussion}
- action explanation: ${gameState.responses.checkpoint2.actionExplanation}
- ai advice: ${gameState.responses.checkpoint2.aiAdvice}

reflections:
1. ${scenario.reflection_prompts[0]}
   ${gameState.responses.reflection.answer1}

2. ${scenario.reflection_prompts[1]}
   ${gameState.responses.reflection.answer2}

badges earned: ${gameState.earnedBadges.join(', ')}
    `.trim();
}

function startOver() {
    // Reset game state but keep team members
    const savedTeam = gameState.teamMembers;
    gameState = {
        teamMembers: savedTeam,
        selectedRole: null,
        selectedScenario: null,
        currentCheckpoint: 1,
        startTime: Date.now(),
        screenTimes: {},
        responses: {
            checkpoint1: { question: null, action: null, groupDiscussion: '', actionExplanation: '', aiAdvice: '' },
            checkpoint2: { question: null, action: null, groupDiscussion: '', actionExplanation: '', aiAdvice: '' },
            reflection: { answer1: '', answer2: '' }
        },
        earnedBadges: []
    };

    // Reset UI selections
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('selected'));

    // Disable continue buttons
    const contScenario = document.getElementById('continueToScenario');
    if (contScenario) contScenario.disabled = true;
    const contMission = document.getElementById('continueToMission');
    if (contMission) contMission.disabled = true;

    // Restore team members in the welcome input
    const teamInput = document.getElementById('teamMembers');
    if (teamInput) {
        teamInput.value = savedTeam;
    }

    // Enable start button since team members are still filled in
    const startBtn = document.getElementById('startMission');
    if (startBtn) startBtn.disabled = !savedTeam;

    showScreen('welcome');
}

function showStatusMessage(message, type) {
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;

    // Insert right above the export buttons so user sees it
    const exportBtns = document.querySelector('.export-buttons');
    if (exportBtns) {
        exportBtns.parentNode.insertBefore(statusDiv, exportBtns);
    } else {
        const activeCard = document.querySelector('.screen.active .card__body');
        if (!activeCard) return;
        activeCard.appendChild(statusDiv);
    }

    setTimeout(() => {
        statusDiv.remove();
    }, 3000);
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function startTimeTracking() {
    // Create time tracker element
    const timeTracker = document.createElement('div');
    timeTracker.className = 'time-tracker';
    timeTracker.id = 'timeTracker';
    document.body.appendChild(timeTracker);
    
    // Update time every second
    setInterval(() => {
        const elapsed = Date.now() - gameState.startTime;
        timeTracker.textContent = `${formatTime(elapsed)}`;
    }, 1000);
}

// Auto-save functionality
setInterval(() => {
    if (gameState.selectedRole && gameState.selectedScenario) {
        const saveData = {
            gameState,
            timestamp: Date.now()
        };
        // Note: localStorage is not available in the sandbox environment
        // This is here for reference if deployed elsewhere
        // localStorage.setItem('mindshift-autosave', JSON.stringify(saveData));
    }
}, 30000); // Save every 30 seconds

// Keyboard navigation
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && event.ctrlKey) {
        // Ctrl+Enter to continue (if button is enabled)
        const activeScreen = document.querySelector('.screen.active');
        if (!activeScreen) return;
        const continueButton = activeScreen.querySelector('.btn--primary:not(:disabled)');
        if (continueButton) {
            continueButton.click();
        }
    }
});

// Keyboard navigation for dynamically created choice options
document.addEventListener('keydown', function(event) {
    if (event.target.classList.contains('choice-option')) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.target.click();
        }
    }
});