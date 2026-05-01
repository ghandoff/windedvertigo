# literature review: subjective judgment tasks & authentic formative assessment

*prepared for Winded Vertigo — foundational research for a lesson-plan-to-task generation system*
*date: march 2026*

---

## 1. the core tension: two traditions of assessment

The field sits at a productive fault line between two fundamentally different ways of thinking about assessment. One tradition — the psychometric view — treats assessment as an inferential process focused on an invisible, theoretical construct such as knowledge or competency. The other — the evaluative judgment tradition, championed by Sadler (1989) — treats assessment as the direct appraisal of the quality of a student's performance by a knowledgeable person, involving multiple criteria applied simultaneously, and not reducible to a formula that can be applied by non-experts.

This distinction matters enormously for a task generation system. Most AI-generated assessment tools default to the psychometric tradition because it's easier to automate. But the most educationally meaningful assessment — particularly formative assessment of subjective judgment tasks — lives in the evaluative tradition. Formative evaluative judgments should be seen as a legitimate form of professional practice, and performance tasks such as argumentative texts, lab work, and oral presentations should not be replaced by tests or other standardised assessments, since this is likely to have a negative impact on students' development of their own evaluative judgment and self-regulation of learning (Frontiers in Education, 2020).

The design challenge is rare: a generation system that honours both — using psychometric rigour to scaffold tasks that develop genuine evaluative capacity.

---

## 2. what makes a task authentically "subjective"

The literature draws a functional distinction between objective and subjective assessments that's useful as a design anchor.

A subjective assessment involves an evaluator's personal judgment or opinion to determine the quality of responses. There is no single correct answer, and these assessments often require critical thinking, creativity, and interpretation. They are evaluated by trained individuals, use flexible scoring criteria, and encourage higher-order thinking: analysis, synthesis, and personal expression (Atomic Jolt, 2023).

Crucially, the authenticity of a task is not a fixed property — it's relational. Authenticity is subjective in nature; what one person views as authentic might not be regarded the same by another. It must therefore be evaluated against specific elements: whether it transfers knowledge from theory to practice, whether it involves meaningful collaboration, whether it incorporates metacognition and student reflection, and whether the environment and tools mirror the students' field of study (UIC CATE).

The six canonical criteria for judging the quality of a formative assessment task — drawn from Baquero-Vargas & Pérez-Salas (2023) — are: **realism, complexity, challenge, collaboration, reflection, and diversity**. Research using these criteria found that, in general, tasks need to be more complex, collaborative, reflective, and diversified — and that the structure of tasks (objective vs. subjective) fundamentally influences which authenticity features are achievable.

This six-dimension framework is directly applicable to a generator's evaluation logic.

---

## 3. constructive alignment: the psychometric backbone

The most methodologically grounded framework for generating tasks from lesson plans and syllabi is **constructive alignment**, developed by John Biggs (1996). Constructive alignment is the synchrony between intended learning outcomes (ILOs), teaching activities, and assessments. It has been shown to enhance student learning, motivation, performance, and students' perceptions of teaching (Tandfonline, 2022).

The mechanism is precise: course learning outcomes specify an activity using a cognitive action verb from Bloom's Taxonomy that students should engage in, in relation to specific content and context. The corresponding assessment task then measures student attainment of those outcomes by requiring them to demonstrate a behaviour defined by a similar cognitive action verb. If the learning outcome requires students to *analyse* some content, the assessment task should require some form of analysis (Library Glion, 2022).

When the same or a similar cognitive action verb is specified in the course learning outcomes, tested in the course assessment, and carried out by students during learning activities, the course is fully aligned — and students are effectively "entrapped in a web of consistency from which they cannot escape without learning" (Biggs et al., 2022, p. 96).

This gives a task generator a concrete parsing target: **extract the cognitive action verb from the learning objective, classify it on Bloom's taxonomy, and generate a task whose prompt requires the same cognitive operation.** That's the minimal validity guarantee.

---

## 4. bloom's taxonomy and cognitive level classification

Bloom's taxonomy (Bloom, 1956; revised Anderson & Krathwohl, 2001) provides the classification architecture that makes automated task generation methodologically defensible.

The taxonomy is useful in two critical ways: it encourages instructors to think of learning objectives in behavioural terms — what the learner can *do* as a result of instruction — and it highlights the need for learning objectives that require higher-order cognitive skills leading to deeper learning and transfer (PMC, 2015).

Bloom's taxonomy helps instructors create valid and reliable assessments by aligning course learning objectives to a given level of student understanding or proficiency. Research suggests that much of conventional college assessment involves only the first level — recall — while the taxonomy enables instructors to create assessments addressing all six levels of the cognitive domain (UIC CATE).

**The six cognitive levels a generator needs to classify and match:**

| level | cognitive operation | example verbs |
|-------|-------------------|---------------|
| remember | retrieve from memory | list, define, recall, name |
| understand | construct meaning | explain, summarise, classify, describe |
| apply | use in a new situation | solve, demonstrate, use, execute |
| analyse | break into component parts | compare, differentiate, examine, attribute |
| evaluate | make judgments based on criteria | critique, judge, assess, justify |
| create | produce something new | design, construct, formulate, compose |

Higher-order cognitive skills (HOCS) span the top three; lower-order cognitive skills (LOCS) span the bottom three. Even if teaching activities are designed to develop higher-order thinking, if the related assessments do not require it, students will not prioritise strategies for developing these skills, since they are not rewarded by the assessment (Tandfonline, 2022).

Recent empirical work has operationalised this: an XAI framework for automated lesson plan generation achieved a classification F1-score of 91.8% when predicting both cognitive process levels and knowledge dimensions from learning objectives, using a transformer-based classifier with attention-enhanced representations — with generated content rated at a mean expert pedagogical alignment score of 4.43/5 (MDPI Computers, 2025). This is a strong proof of concept for the technical feasibility of automated task generation.

---

## 5. the psychometrics of subjective task scoring

Once tasks are generated, a system needs to grapple with the psychometric properties of how they will be scored.

### 5a. the validity-reliability tension

There is a fundamental tension between the two key psychometric properties of assessments. Higher reliability can be attained by standardising the testing procedure — but standardisation has the potential to reduce the breadth of the construct being measured and thus decrease validity. For example, interrater reliability is increased by standardising the scoring procedure through clearly defined rubrics and training, but this standardisation can limit the definition of good performance by excluding some types of response from the rubric (ScienceDirect Topics).

This is not a problem to be solved — it's a design trade-off to be managed. A generation system will need to make explicit decisions about where on the reliability-validity continuum each generated task sits.

### 5b. inter-rater reliability mechanics

For subjective tasks, the primary psychometric concern is inter-rater reliability — the degree of agreement among independent evaluators scoring the same work.

Inter-rater reliability refers to the consistency between raters, which is distinct from agreement. Reliability can be quantified by a correlation coefficient — often an intraclass correlation (ICC), especially with more than two raters. If raters correlate highly, they are consistent with each other even if they do not assign the same absolute scores (Assessment Systems).

**Conventional reliability benchmarks for subjective assessment:**
- ICC 0.5–0.75: moderate reliability
- ICC 0.75–0.90: good reliability
- ICC > 0.90: excellent reliability

For any given task, the internal consistency of scores from subjective ratings may be low, but they consistently show higher consistency across tasks compared to objective assessments. Expert subjective assessment is criterion-referenced, built from observation over time, and yields many formative feedback opportunities — precisely the characteristics that make it valuable (PMC, 2021).

**Key inter-rater statistics and when to use them:**
- **Cohen's kappa / Fleiss' kappa**: nominal and ordinal data, corrects for chance agreement
- **ICC (intraclass correlation coefficient)**: interval/ratio data, handles more than two raters, distinguishes reliability from agreement
- **Krippendorff's alpha**: most flexible — handles any number of raters, any measurement level, missing data
- **Percent agreement**: simple but does not correct for chance; use as supplementary evidence only

### 5c. rubric design and scoring instrument choice

The scoring instrument dramatically affects reliability. Studies comparing analytic rubrics and rating scales in performance assessment have found mixed results: some show rating scales yield higher inter-rater reliability and are faster to score, while others find that analytic rubrics allow raters to reach higher levels of agreement, particularly for complex performances like clinical portfolios (ScienceDirect, 2024).

The general principle: analytic rubrics (with detailed behavioural descriptions at each performance level) improve the interpretability and fairness of scoring, while holistic rating scales are more efficient. Rubrics — as scoring tools containing criteria and descriptions of performance levels — solve the problem of Likert-type ratings that yield scores that are subjectively derived with limited formative value because they lack behavioural anchors for each domain (PMC, 2021).

**For a task generation system**: every generated task should be paired with a generated analytic rubric whose criteria explicitly map to the learning outcome's cognitive level and the task's authenticity dimensions.

---

## 6. evaluative judgment: the deeper educational goal

The richest vein in this literature, and the one most aligned with WV's philosophy, is the theory of **evaluative judgment** — the idea that the ultimate aim of formative assessment is not just to measure learning, but to cultivate students' capacity to assess quality for themselves.

Evaluative judgment is the capability to make decisions about the quality of work of oneself and others. The origin of the concept traces to Sadler's (1989) ideas of 'evaluative knowledge' — a form of expertise that students must develop to become progressively independent of their teachers. The argument is that developing students' evaluative judgment should be a goal of higher education itself, not merely an output of it (Tai et al., 2018, Higher Education).

Sadler's key premise: for students to be able to improve, they must develop the capacity to monitor the quality of their own work during actual production. This in turn requires that students possess an appreciation of what high quality work is, and the evaluative skill necessary to compare their current performance with the standard they are aiming for (Sadler, 1989).

The pedagogical implication for a generation system: tasks that develop evaluative judgment are not merely tasks that are well-calibrated to the learning outcome — they are tasks that make quality criteria visible, that invite students into the act of appraisal, and that build the internal standard that allows self-monitoring without external judgment.

Sadler proposed that students needed to understand criteria in relation to the standards required for making quality judgments before being able to appreciate feedback about their performance — and that peer review was an important method for developing this capability, since engaging students in making judgments and interacting with criteria develops understandings of quality and tacit knowledge that educators already hold (Sadler, 2010; Nicol, 2014).

### 6a. the feedback literacy connection

Assessment design is frequently critiqued for being unidirectional, excessively content and task focused, while also positioning students as passive recipients of feedback information. Worse than failing to support the development of evaluative judgement, these approaches may even inhibit it, by producing graduates dependent on others' assessment of their work, who are not able to identify criteria to apply in any given context (Tai et al., 2018).

The implication: tasks should be designed not just to elicit performance, but to make the criteria of quality learnable through the doing of the task itself.

---

## 7. alignment empirics: what breaks in practice

The empirical literature on lesson-plan-aligned task generation is nascent but directionally clear.

Studies of alignment between learning objectives and assessment tasks in real classrooms reveal consistent discrepancies — some learning outcomes lack any corresponding assessment task, and in many lesson plans a single assessment task indirectly measures the intended outcomes rather than directly targeting them. Aligning learning objectives, teaching-learning activities, and assessment tasks is considered crucial: when curriculum, teaching, and assessment are aligned, teachers are less likely to focus solely on test preparation and are better positioned to support overall learning (ERIC, 2024).

Mapping learning outcomes to both class activities and assessment tasks can reveal important issues and omissions — that assessment plans ignore some learning outcomes, or that class activities are unrelated to any learning outcome. Learning outcomes are most useful when limited in number, when each includes a description of the performances by which achievement will be judged, and when they specify how complex the required performance should be (UNSW Staff Teaching Gateway).

This validates the core logic of the system: the input parsing stage should produce a structured map of outcomes → Bloom's levels → cognitive verbs, and the generation stage should propagate that structure through to task prompts, scoring instruments, and feedback scaffolds.

---

## 8. system design implications

Drawing across the full literature, a methodologically sound task generation system built on this theoretical base should incorporate the following layers:

### parsing layer
Extract and classify learning objectives from submitted lesson plans and syllabi. Identify cognitive action verbs, map to Bloom's taxonomy levels, and flag gaps where outcomes exist without aligned assessment coverage. The XAI literature suggests transformer-based classifiers can achieve this with high reliability (F1 > 0.90).

### task generation layer
Generate task prompts whose required cognitive operation matches the Bloom's level of the learning objective. Use the six authenticity criteria (realism, complexity, challenge, collaboration, reflection, diversity) as a configuration surface — teachers can tune task type along these dimensions. Generate a diversity of task formats rather than defaulting to essay prompts: performance tasks, scenario-based judgment tasks, peer review protocols, self-assessment exercises, oral presentations.

### rubric generation layer
For every task, generate a companion analytic rubric with behavioural descriptors anchored to each performance level. Criteria should map explicitly to the learning outcome's cognitive level and the task's authenticity profile. This is the mechanism by which the system supports evaluative judgment development: making quality criteria visible and learnable, not just gradable.

### calibration and reliability layer
Provide teachers with tools for estimating inter-rater reliability when multiple raters score the same work. Surface the construct-level meaning of score distributions, not just summary statistics. Flag when a scoring instrument may be constraining the breadth of what's actually being measured.

### evaluative judgment scaffolds
Design task structures that invite students into the appraisal process — peer review protocols, guided self-assessment prompts, exemplar comparison activities. These are not add-ons; they are the mechanism by which subjective judgment tasks develop transfer.

---

## 9. key sources

| source | contribution |
|--------|-------------|
| Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science, 18*, 119–144. | foundational theory of evaluative judgment and qualitative formative assessment |
| Tai, J., Ajjawi, R., Boud, D., Dawson, P., & Panadero, E. (2018). Developing evaluative judgement. *Higher Education, 76*, 467–481. | defines evaluative judgment as graduate capability; maps pedagogical approaches |
| Biggs, J. (1996). Enhancing teaching through constructive alignment. *Higher Education, 32*, 347–364. | constructive alignment framework; ILO-activity-assessment synchrony |
| Anderson, L. W., & Krathwohl, D. R. (2001). *A taxonomy for learning, teaching, and assessing.* Longman. | revised Bloom's taxonomy; cognitive action verb classification |
| Baquero-Vargas, M.-P., & Pérez-Salas, C. P. (2023). Authenticity of formative assessment tasks. *Journal of Higher Education Theory and Practice, 23*(2). | six-dimension authenticity framework for task evaluation |
| MDPI Computers, 14(11), 494 (2025). XAI framework for automated lesson plan generation. | empirical proof of concept for AI-based Bloom's classification (F1=0.918) |
| ETS (2012). *Best practices for constructed-response scoring.* Educational Testing Service. | psychometric standards for subjective scoring at scale |
| Shrout, P. E., & Fleiss, J. L. (1979). Intraclass correlations: uses in assessing rater reliability. *Psychological Bulletin, 86*, 420–428. | canonical reference for ICC-based inter-rater reliability |
| ScienceDirect (2024). Comparing reliability of performance task scores using generalizability theory. | rubric vs. rating scale reliability comparison |

---

*this document is intended as a stable reference for design sessions. it should be read alongside the system prompt and CLAUDE.md for the task generation project.*
