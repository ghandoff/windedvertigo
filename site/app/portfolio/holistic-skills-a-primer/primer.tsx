import Image from "next/image";
import styles from "./primer.module.css";

type Measure = { label: string; href?: string };

type Skill = {
  name: string;
  definition: string;
  inPractice: string[];
  measures: Measure[];
};

const SOCIAL_BEHAVIORAL_SKILLS: Skill[] = [
  {
    name: "openness (to experience)",
    definition:
      "openness to experience reflects willingness to engage with novel ideas, perspectives, and situations. it involves curiosity about the world, appreciation for diverse viewpoints, and comfort with exploration beyond familiar boundaries. research shows openness predicts creative achievement, adaptability, and learning from experience (Fung & Chung, 2025).",
    inPractice: [
      "activities that expose students to unfamiliar concepts, cultures, or ways of thinking",
      "invitations to explore topics outside their disciplinary comfort zones",
      "reflection prompts asking students to consider perspectives different from their own",
      "opportunities to experiment with new methods, tools, or approaches without predetermined “right answers”",
    ],
    measures: [
      {
        label: "codebook: openness to experience (BFI-2-S)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Openness-to-Experience-BFI-2-S-8eb8271c35e0471e807f9ae928b4fb02",
      },
      {
        label: "TIPI openness to experience",
        href: "https://superb-shrimp-129.notion.site/Codebook-TIPI-Openness-to-Experience-4835cb8ad34e46a1b07c48776a606274",
      },
      {
        label: "curiosity pre/post survey",
        href: "https://superb-shrimp-129.notion.site/Codebook-Curiosity-Pre-Post-Survey-dbdc4c3027b44d16b39994f4f2836d7a",
      },
    ],
  },
  {
    name: "adaptability",
    definition:
      "adaptability is the capacity to adjust thoughts, behaviors, and strategies in response to changing conditions. it involves cognitive flexibility, tolerance for uncertainty, and willingness to revise plans when circumstances shift. adaptability is increasingly recognized as essential for navigating volatility and complexity.",
    inPractice: [
      "learning activities that introduce unexpected changes or constraints",
      "scenarios requiring students to pivot strategies based on new information",
      "reflection on how initial assumptions needed revision",
      "practice navigating ambiguous situations without clear “correct” paths",
    ],
    measures: [
      {
        label: "adaptability & inquiry (9-item)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Adaptability-Inquiry-9-item-cb9bb560db4c4152914fd21763f9a2ef",
      },
      {
        label: "adaptability & inquiry SJT (pre/post)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Adaptability-Inquiry-SJT-Pre-Post-a7e74b0a6ea84e7d89758ffd1aa06ab9",
      },
      {
        label: "cross-cultural business education SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Cross-Cultural-Adaptability-SJT-ece84c9cfcb342d8954ee90cec874161",
      },
      {
        label:
          "intellectual humility-adaptability subscale — items measuring willingness to revise beliefs and adapt to new evidence",
      },
    ],
  },
  {
    name: "agency",
    definition:
      "agency is the sense that one can influence outcomes through intentional action. it involves self-efficacy, internal locus of control, and belief in one’s capacity to shape learning and work. research links agency to persistence, motivation, and achievement across domains.",
    inPractice: [
      "student choice in topics, methods, or demonstration of learning",
      "opportunities for students to set goals and monitor their own progress",
      "activities where students design solutions rather than implementing prescribed steps",
      "reflection on moments when students influenced outcomes or made meaningful decisions",
    ],
    measures: [
      {
        label: "agency & locus of control (Rotter, 1966)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Agency-Locus-of-Control-d0517a016d624db7b2f088a8fff7f56e",
      },
      {
        label: "teaching self-efficacy (adapted for students)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Teaching-Self-Efficacy-Adapted-for-Students-81e337d31262434099aa11b1df3419ef",
      },
      {
        label:
          "agency reflection prompts — qualitative data on students’ sense of control and influence",
      },
    ],
  },
  {
    name: "curiosity",
    definition:
      "curiosity is the intrinsic drive to seek new information and experiences. it involves asking questions, exploring unknowns, and finding joy in discovery. research distinguishes between interest-type curiosity (attraction to specific topics) and deprivation-type curiosity (discomfort with knowledge gaps that motivates seeking).",
    inPractice: [
      "open-ended questions that invite student inquiry",
      "activities beginning with provocations or puzzles rather than explanations",
      "space for students to pursue tangential interests or “rabbit holes”",
      "emphasis on question-generation alongside answer-finding",
    ],
    measures: [
      {
        label: "curiosity pre/post survey (Kashdan et al., 2009)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Curiosity-Pre-Post-Survey-dbdc4c3027b44d16b39994f4f2836d7a",
      },
      {
        label:
          "student-generated question counts — quantifying inquiry behaviors as evidence of curiosity",
      },
    ],
  },
  {
    name: "intellectual humility",
    definition:
      "intellectual humility is the recognition that one’s beliefs and knowledge are fallible. it involves openness to being wrong, respect for others’ viewpoints, and willingness to revise judgments based on evidence. research shows intellectual humility supports learning, collaboration, and constructive disagreement.",
    inPractice: [
      "activities requiring students to consider evidence against their initial positions",
      "discussion norms that reward changing one’s mind in light of new information",
      "reflection on limitations of one’s knowledge or perspective",
      "peer feedback structures that invite constructive challenge",
    ],
    measures: [
      {
        label: "codebook: intellectual humility (15-item)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Intellectual-Humility-15-item-a6d9cf54db444267a977c7663e11efbc",
      },
      {
        label: "cross-cultural business education SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Cross-Cultural-Adaptability-SJT-ece84c9cfcb342d8954ee90cec874161",
      },
      {
        label: "emotional intelligence SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Emotional-Intelligence-SJT-a6de55a29c3d4c23933393ce65b03145",
      },
    ],
  },
  {
    name: "risk aversion (or willingness to take intellectual risks)",
    definition:
      "risk aversion in learning contexts refers to fear of failure or judgment that inhibits exploration and experimentation. conversely, willingness to take intellectual risks involves trying new approaches, sharing tentative ideas, and persisting despite uncertainty. research shows risk-taking supports creative thinking and deep learning (Zosh et al., 2020).",
    inPractice: [
      "low-stakes opportunities to experiment and fail without grade consequences",
      "explicitly framing “mistakes” as valuable learning data",
      "activities rewarding novel attempts over correct answers",
      "psychological safety created through norms and facilitation",
    ],
    measures: [
      {
        label:
          "risk aversion items (reverse-scored) — self-report measures of fear of failure or judgment",
      },
      {
        label:
          "behavioral observation — tracking willingness to volunteer ideas, try new methods, or persist after setbacks",
      },
    ],
  },
  {
    name: "tolerance for ambiguity",
    definition:
      "tolerance for ambiguity is the ability to function effectively in situations lacking clear structure, answers, or outcomes. it involves comfort with complexity, patience with not-knowing, and capacity to hold multiple possibilities simultaneously. research shows tolerance for ambiguity predicts creative problem-solving and cross-cultural effectiveness.",
    inPractice: [
      "problems with multiple plausible solutions or no “right answer”",
      "activities that intentionally leave some aspects undefined or emergent",
      "reflection on discomfort with uncertainty and strategies for navigating it",
      "projects where the path forward must be discovered rather than prescribed",
    ],
    measures: [
      {
        label: "adaptability & inquiry (9-item) — includes tolerance for ambiguity items",
        href: "https://superb-shrimp-129.notion.site/Codebook-Adaptability-Inquiry-9-item-cb9bb560db4c4152914fd21763f9a2ef",
      },
      {
        label: "cross-cultural business education SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Cross-Cultural-Adaptability-SJT-ece84c9cfcb342d8954ee90cec874161",
      },
    ],
  },
  {
    name: "perspective-taking & empathic concern",
    definition:
      "perspective-taking is the cognitive capacity to understand another person’s viewpoint, while empathic concern involves emotional response to others’ experiences. together, these skills enable students to consider stakeholder impacts, navigate difference, and act with compassion. research shows perspective-taking reduces bias and supports ethical decision-making.",
    inPractice: [
      "stakeholder analysis activities requiring students to inhabit multiple viewpoints",
      "case studies examined from diverse roles (e.g., worker, manager, community member, environment)",
      "reflection on how decisions affect different groups differently",
      "structured protocols for listening to and considering others’ experiences",
    ],
    measures: [
      {
        label:
          "codebook: perspective-taking & empathic concern (IRI subscales, Davis 1983)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Perspective-Taking-Empathic-Concern-IRI-Subscales-d9388ae2728d47c8a42225183cf5f1b3",
      },
      {
        label: "emotional intelligence SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Emotional-Intelligence-SJT-a6de55a29c3d4c23933393ce65b03145",
      },
      {
        label: "cross-cultural business education SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Cross-Cultural-Adaptability-SJT-ece84c9cfcb342d8954ee90cec874161",
      },
      {
        label: "communities of practice SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Communities-of-Practice-SJT-7d356e1931a942f7a28283b3d327a02d",
      },
    ],
  },
  {
    name: "self-regulation",
    definition:
      "self-regulation involves monitoring and managing one’s emotions, attention, and behaviors to achieve goals. it includes impulse control, emotional awareness, stress management, and strategic resource allocation. research shows self-regulation predicts academic achievement, well-being, and professional success.",
    inPractice: [
      "metacognitive prompts asking students to monitor their learning strategies",
      "practice managing frustration or confusion during challenging tasks",
      "goal-setting and progress-monitoring structures",
      "reflection on emotional responses and their influence on decision-making",
    ],
    measures: [
      {
        label: "emotional intelligence SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Emotional-Intelligence-SJT-a6de55a29c3d4c23933393ce65b03145",
      },
      {
        label:
          "self-regulation subscale — items measuring emotional management and goal-directed behavior",
      },
    ],
  },
  {
    name: "abundance mindset",
    definition:
      "abundance mindset (contrasted with scarcity mindset) is the belief that opportunities, resources, and success are plentiful rather than zero-sum. it involves generosity, collaboration over competition, and confidence that “enough” exists for all. research links abundance mindset to collaboration, innovation, and well-being.",
    inPractice: [
      "collaborative rather than competitive reward structures",
      "emphasis on shared success and collective achievement",
      "reflection on assumptions about resource scarcity vs. sufficiency",
      "activities reframing “win-lose” scenarios as “win-win” possibilities",
    ],
    measures: [
      {
        label:
          "abundance vs. scarcity mindset items — self-report measures of beliefs about resources and opportunities",
      },
      {
        label:
          "behavioral observation — tracking sharing, collaboration, and generosity in group work",
      },
    ],
  },
];

const COGNITIVE_SKILLS: Skill[] = [
  {
    name: "inquiry",
    definition:
      "inquiry involves asking questions, seeking evidence, and investigating phenomena with systematic curiosity. it includes formulating meaningful questions, designing investigations, and pursuing answers through research or experimentation. research shows inquiry-based learning supports deep understanding and scientific thinking.",
    inPractice: [
      "activities beginning with student-generated questions",
      "structured protocols for designing investigations or research plans",
      "emphasis on question quality, not just answer accuracy",
      "practice distinguishing researchable questions from opinion or preference",
    ],
    measures: [
      {
        label: "curiosity pre/post survey — includes inquiry disposition items",
        href: "https://superb-shrimp-129.notion.site/Codebook-Curiosity-Pre-Post-Survey-dbdc4c3027b44d16b39994f4f2836d7a",
      },
      {
        label: "critical thinking disposition scale (CTDS) — includes inquiry subscale items",
        href: "https://superb-shrimp-129.notion.site/Codebook-Critical-Thinking-Disposition-Scale-CTDS-86fb34588fdb47619bdbbd4f8bac5f72",
      },
      {
        label:
          "student-generated question analysis — qualitative coding of question depth and sophistication",
      },
    ],
  },
  {
    name: "analysis & evaluation",
    definition:
      "analysis involves breaking down complex information into components to understand relationships, patterns, and structures. evaluation involves judging quality, validity, or significance based on criteria. together, these skills enable critical examination of arguments, evidence, and claims.",
    inPractice: [
      "activities requiring students to identify assumptions, evidence, and logic in arguments",
      "comparative analysis of multiple sources or perspectives",
      "criteria-based evaluation of solutions, designs, or proposals",
      "practice distinguishing fact from interpretation, evidence from opinion",
    ],
    measures: [
      {
        label: "critical thinking disposition scale (CTDS, Sosu 2013)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Critical-Thinking-Disposition-Scale-CTDS-86fb34588fdb47619bdbbd4f8bac5f72",
      },
      {
        label: "OECD critical thinking rubric (OECD, 2019)",
        href: "https://superb-shrimp-129.notion.site/Codebook-OECD-Critical-Thinking-Rubric-77cc6bdbd86c45e0addb957a66e37594",
      },
    ],
  },
  {
    name: "synthesis",
    definition:
      "synthesis is the integration of ideas from multiple sources into coherent new understanding. it involves identifying connections, building frameworks, and creating unified perspectives from diverse inputs. research shows synthesis is central to learning, creativity, and knowledge-building.",
    inPractice: [
      "assignments requiring integration of readings, experiences, or perspectives",
      "concept-mapping or framework-building activities",
      "projects asking students to create something new from existing elements",
      "reflection connecting seemingly disparate ideas or domains",
    ],
    measures: [
      {
        label: "synthesis of ideas items — self-report or rubric-based measures of integrative thinking",
      },
      {
        label: "concept map analysis — scoring complexity and quality of connections in student-generated maps",
      },
    ],
  },
  {
    name: "extending ideas",
    definition:
      "extending ideas involves taking existing concepts or solutions and pushing them further — applying them to new contexts, elaborating their implications, or building upon them incrementally. this skill bridges understanding and innovation (Fung & Chung, 2025).",
    inPractice: [
      "prompts asking “what if…?” or “how else could…?”",
      "activities applying course concepts to new or unexpected contexts",
      "encouragement to build on peers’ contributions rather than replace them",
      "iteration and refinement rather than single-draft work",
    ],
    measures: [
      {
        label: "creativity & novelty seeking (10-item) — includes items on elaboration and extending ideas",
        href: "https://superb-shrimp-129.notion.site/Codebook-Creativity-Novelty-Seeking-10-item-ed58bc9ff8e74f7a9fdebb87c40488dd",
      },
      { label: "idea development rubrics — scoring how students build upon initial concepts" },
    ],
  },
  {
    name: "conventional ideas (as a stepping stone)",
    definition:
      "conventional ideas represent the common, established, or “standard” approaches within a domain. while sometimes framed as the opposite of creativity, conventional thinking provides necessary grounding — you must know the norms to meaningfully innovate beyond them (Fung & Chung, 2025).",
    inPractice: [
      "explicit teaching of disciplinary conventions and standards",
      "activities comparing conventional and novel approaches",
      "reflection on when to follow norms versus when to break them",
      "use of templates or models as scaffolds for later innovation",
    ],
    measures: [
      { label: "divergent thinking assessments: common responses — counting typical vs. unusual ideas generated" },
      { label: "knowledge assessments — testing understanding of domain conventions as foundation for creativity" },
    ],
  },
  {
    name: "generating diverse ideas",
    definition:
      "this skill involves producing many different kinds of ideas across categories, domains, or perspectives. it emphasizes breadth and variety over depth or refinement. research shows idea diversity predicts creative problem-solving and innovation (Fung & Chung, 2025).",
    inPractice: [
      "brainstorming activities with explicit goals for quantity and variety",
      "prompts to consider ideas from different stakeholder perspectives or disciplines",
      "“crazy eights” or rapid ideation protocols",
      "rewards for unusual or unexpected responses",
    ],
    measures: [
      {
        label: "creativity & novelty seeking (10-item)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Creativity-Novelty-Seeking-10-item-ed58bc9ff8e74f7a9fdebb87c40488dd",
      },
      {
        label:
          "divergent thinking tests: flexibility score (Fung & Chung, 2025) — counting number of different categories in idea generation",
      },
      { label: "ideation rubrics — scoring variety and breadth in brainstorming outputs" },
    ],
  },
  {
    name: "generating creative ideas",
    definition:
      "creative idea generation produces original, novel, or unusual ideas that break from conventional patterns. it involves divergent thinking, remote association, and willingness to propose “weird” possibilities. research distinguishes creative quantity (fluency) from creative quality (originality) (Fung & Chung, 2025).",
    inPractice: [
      "explicit permission for “wild” or unconventional ideas",
      "deferred judgment during ideation phases",
      "prompts that constrain in unusual ways (e.g., “solve this problem using only things found in nature”)",
      "celebration of surprising or counterintuitive suggestions",
    ],
    measures: [
      {
        label: "creativity & novelty seeking (10-item)",
        href: "https://superb-shrimp-129.notion.site/Codebook-Creativity-Novelty-Seeking-10-item-ed58bc9ff8e74f7a9fdebb87c40488dd",
      },
      {
        label:
          "divergent thinking tests: originality score (Fung & Chung, 2025) — rating unusualness of ideas generated",
      },
      { label: "creative product rubrics — scoring novelty and surprise in student work" },
    ],
  },
  {
    name: "improving ideas",
    definition:
      "improving ideas involves taking initial concepts and refining, elaborating, or enhancing them through iteration. it includes giving and receiving feedback, recognizing limitations, and making strategic revisions. research shows iteration is central to design thinking and creative problem-solving (Zosh et al., 2020).",
    inPractice: [
      "structured revision processes with peer or instructor feedback",
      "portfolios showing multiple drafts and evolution of thinking",
      "reflection on what changed and why between iterations",
      "critique protocols focused on constructive improvement",
    ],
    measures: [
      { label: "revision analysis — comparing quality gains across drafts" },
      { label: "feedback integration rubrics — scoring how effectively students incorporate critique" },
    ],
  },
  {
    name: "planning",
    definition:
      "planning involves setting goals, anticipating steps, allocating resources, and organizing action toward desired outcomes. it includes strategic thinking, time management, and the ability to break complex goals into manageable parts. research links planning to academic achievement and project success.",
    inPractice: [
      "project timelines or Gantt charts created by students",
      "goal-setting activities with specific, measurable objectives",
      "anticipation of obstacles and contingency planning",
      "reflection on alignment between plans and actual implementation",
    ],
    measures: [
      {
        label: "problem-solving & implementation SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Problem-Solving-Implementation-SJT-1a20e8169dca4c229e464514c8e9f01d",
      },
      { label: "planning process rubrics — scoring quality of project plans, timelines, and resource allocation" },
      { label: "self-regulation items: planning subscale — self-report measures of planning behaviors" },
    ],
  },
  {
    name: "executing",
    definition:
      "executing is the implementation of plans — taking action, managing resources, coordinating efforts, and maintaining momentum toward goals. it involves persistence, task management, and adaptive implementation when plans meet reality.",
    inPractice: [
      "opportunities for students to carry out their designs or plans",
      "progress checkpoints and accountability structures",
      "reflection on obstacles encountered during implementation and how they were addressed",
      "balance between following plans and adapting when necessary",
    ],
    measures: [
      {
        label: "problem-solving & implementation SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Problem-Solving-Implementation-SJT-1a20e8169dca4c229e464514c8e9f01d",
      },
      { label: "project completion rates — tracking successful implementation of student plans" },
      { label: "execution quality rubrics — scoring fidelity to plans and adaptive responses to challenges" },
    ],
  },
  {
    name: "monitoring",
    definition:
      "monitoring involves tracking progress toward goals, assessing whether strategies are working, and recognizing when adjustments are needed. it includes metacognitive awareness, self-assessment, and use of feedback. research shows monitoring is essential for self-regulated learning.",
    inPractice: [
      "structured check-ins where students assess their own progress",
      "reflection on strategy effectiveness",
      "use of rubrics or criteria to self-evaluate",
      "adjustment of approaches based on interim feedback",
    ],
    measures: [
      {
        label: "problem-solving & implementation SJT",
        href: "https://superb-shrimp-129.notion.site/Codebook-Problem-Solving-Implementation-SJT-1a20e8169dca4c229e464514c8e9f01d",
      },
      { label: "metacognitive awareness inventory — items measuring monitoring and self-regulation during learning" },
      { label: "learning journal analysis — coding evidence of self-monitoring in reflective writing" },
    ],
  },
];

const SKILLSETS = [
  {
    icon: "⚖️",
    name: "critical thinking",
    desc: "the capacity to analyze information, evaluate evidence, question assumptions, and form reasoned judgments. critical thinking enables students to navigate complex problems and make sound decisions in contexts of uncertainty.",
  },
  {
    icon: "🎯",
    name: "self-directed learning",
    desc: "the capacity to take ownership of one’s learning journey, set meaningful goals, pursue knowledge independently, and persist through challenges. self-directed learning enables students to become lifelong learners who actively shape their own development.",
  },
  {
    icon: "💡",
    name: "creative thinking",
    desc: "the capacity to generate novel ideas, make unexpected connections, and imagine new possibilities. creative thinking enables students to innovate, adapt existing solutions to new contexts, and approach problems with fresh perspectives.",
  },
  {
    icon: "🔧",
    name: "problem-solving",
    desc: "the capacity to identify challenges, design strategies, implement solutions, and monitor progress toward goals. problem-solving enables students to navigate real-world complexity and turn ideas into action.",
  },
  {
    icon: "🔗",
    name: "collaboration",
    desc: "the capacity to work effectively with others, contribute to shared goals, navigate difference, and co-create solutions. collaboration enables students to leverage collective intelligence and build inclusive, productive relationships.",
  },
];

function MeasureItem({ measure }: { measure: Measure }) {
  if (measure.href) {
    return (
      <li>
        <a href={measure.href} target="_blank" rel="noopener noreferrer">
          {measure.label}
        </a>
      </li>
    );
  }
  return <li>{measure.label}</li>;
}

function SkillBlock({ skill }: { skill: Skill }) {
  return (
    <div className={styles.skillBlock}>
      <h4>{skill.name}</h4>
      <p>{skill.definition}</p>
      <span className={styles.skillLabel}>in practice: what to look for</span>
      <ul>
        {skill.inPractice.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <span className={styles.skillLabel}>validated measures</span>
      <ul>
        {skill.measures.map((m) => (
          <MeasureItem key={m.label} measure={m} />
        ))}
      </ul>
    </div>
  );
}

function Divider() {
  return (
    <Image
      src="/portfolio/holistic-skills-a-primer/img/divider.png"
      alt=""
      role="presentation"
      width={1260}
      height={45}
      className={styles.divider}
      aria-hidden="true"
    />
  );
}

export function Primer() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.containerWide}>
        <header className={styles.intro}>
          <span className={styles.contextLabel}>primer</span>
          <h1 className={styles.pageTitle}>holistic skills: a primer</h1>
        </header>
      </div>

      <div className={styles.container}>
        <aside className={styles.callout}>
          <p className={styles.calloutLead}>
            for PRME pedagogy certificate series participants
          </p>
          <p>
            a comprehensive guide to understanding, identifying, and measuring
            holistic skills development in responsible management education.
          </p>
        </aside>

        <article className={styles.body}>
          <h2>what is the holistic skills framework?</h2>
          <p>
            the holistic skills framework was developed specifically for the
            PRME community to support educators in designing learning
            experiences that develop students as whole persons — not just as
            repositories of content knowledge. this framework organizes{" "}
            <strong>five core skillsets</strong> that research shows are
            essential for navigating complexity, uncertainty, and transformation
            in business and society.
          </p>
          <p>
            each skillset is composed of specific, teachable{" "}
            <strong>individual skills</strong> that span two domains:
          </p>
          <ul>
            <li>
              <strong>social &amp; behavioral skills</strong>: how we relate to
              others, regulate ourselves, and engage with the world
            </li>
            <li>
              <strong>cognitive skills</strong>: how we think, analyze, create,
              and solve problems
            </li>
          </ul>
          <p>
            the framework is intentionally interconnected. individual skills
            often contribute to multiple skillsets, reflecting the reality that
            human capabilities are not isolated competencies but dynamic,
            overlapping capacities.
          </p>

          <h2>the five skillsets</h2>
          <div className={styles.skillsetGrid}>
            {SKILLSETS.map((s) => (
              <div key={s.name} className={styles.skillsetCard}>
                <span className={styles.skillsetIcon} aria-hidden="true">
                  {s.icon}
                </span>
                <h3 className={styles.skillsetName}>{s.name}</h3>
                <p className={styles.skillsetDesc}>{s.desc}</p>
              </div>
            ))}
          </div>

          <h2>understanding the framework map</h2>
          <p>
            the framework visualizes how <strong>individual skills</strong>{" "}
            (shown as blocks on the sides) connect to{" "}
            <strong>skillsets</strong> (shown as central circles). each skill
            block has a color-coded bar showing which skillsets it contributes
            to:
          </p>
          <ul className={styles.colorKey}>
            <li>
              <span
                className={`${styles.swatch} ${styles.swatchNavy}`}
                aria-hidden="true"
              />
              navy = self-directed learning
            </li>
            <li>
              <span
                className={`${styles.swatch} ${styles.swatchRust}`}
                aria-hidden="true"
              />
              rust = critical thinking
            </li>
            <li>
              <span
                className={`${styles.swatch} ${styles.swatchBlue}`}
                aria-hidden="true"
              />
              blue = creative thinking
            </li>
            <li>
              <span
                className={`${styles.swatch} ${styles.swatchGreen}`}
                aria-hidden="true"
              />
              green = problem-solving
            </li>
            <li>
              <span
                className={`${styles.swatch} ${styles.swatchOrange}`}
                aria-hidden="true"
              />
              orange = collaboration
            </li>
          </ul>
          <p>
            for example, <strong>intellectual humility</strong> (a
            social/behavioral skill) contributes to critical thinking, creative
            thinking, problem-solving, AND collaboration — reflecting its
            importance across multiple domains of competence.
          </p>
          <Image
            src="/portfolio/holistic-skills-a-primer/img/framework-map.png"
            alt="diagram showing how individual skills connect to the five core skillsets, with color-coded bars indicating skillset membership"
            width={1802}
            height={1746}
            className={styles.frameworkMap}
            sizes="(max-width: 768px) 100vw, 70ch"
          />

          <Divider />

          <h2>individual skills: definitions, identification, and measurement</h2>
          <p>
            below you’ll find detailed guidance on each skill in the framework.
            for each skill, we provide:
          </p>
          <ol>
            <li>
              <strong>definition</strong>: how the skill is understood in
              research
            </li>
            <li>
              <strong>in practice</strong>: what to look for in lesson plans or
              learning activities
            </li>
            <li>
              <strong>validated measures</strong>: surveys or situational
              judgment tasks that can capture student growth
            </li>
          </ol>

          <details className={styles.toggle}>
            <summary className={styles.toggleSummary}>
              social &amp; behavioral skills
            </summary>
            <div className={styles.toggleBody}>
              {SOCIAL_BEHAVIORAL_SKILLS.map((skill) => (
                <SkillBlock key={skill.name} skill={skill} />
              ))}
            </div>
          </details>

          <details className={styles.toggle}>
            <summary className={styles.toggleSummary}>cognitive skills</summary>
            <div className={styles.toggleBody}>
              {COGNITIVE_SKILLS.map((skill) => (
                <SkillBlock key={skill.name} skill={skill} />
              ))}
            </div>
          </details>

          <Divider />

          <h2>selecting measures for your lesson</h2>
          <p>
            when selecting measures to demonstrate student outcomes for the
            Certificate of Excellence, consider:
          </p>

          <h3>1. alignment with your learning goals</h3>
          <p>
            which skills does your lesson or activity explicitly target? if
            you’ve designed an activity to develop perspective-taking, measure
            perspective-taking — not a different skill that happens to be
            easier to assess.
          </p>

          <h3>2. evidence pathway fit</h3>
          <p>
            PRME Certificate of Excellence allows three evidence pathways:
            student artifacts, student feedback/reflection, and
            assessment/performance data. some skills lend themselves to:
          </p>
          <ul>
            <li>
              <strong>artifacts</strong> (e.g., analysis &amp; evaluation visible
              in written work)
            </li>
            <li>
              <strong>reflection</strong> (e.g., tolerance for ambiguity
              described in learning journals)
            </li>
            <li>
              <strong>pre/post surveys or SJTs</strong> (e.g., adaptability,
              intellectual humility, emotional intelligence)
            </li>
          </ul>

          <h3>3. practical constraints</h3>
          <p>
            consider class size, time available, and your comfort with
            different assessment methods. brief pre/post surveys work well in
            large classes; SJTs can be administered online; artifact analysis
            requires more time but provides rich qualitative data.
          </p>

          <h3>4. combining multiple measures</h3>
          <p>
            the strongest evidence combines quantitative and qualitative data.
            for example: pre/post adaptability survey + student reflection on a
            moment they had to pivot their approach + your observation of
            flexible thinking in their final project.
          </p>

          <Divider />

          <h2>accessing measures</h2>
          <p>
            all validated measures referenced in this primer are available as{" "}
            <strong>documentation pages</strong> that include:
          </p>
          <ul>
            <li>complete item lists with response scales</li>
            <li>scoring instructions (including reverse-keyed items)</li>
            <li>administration guidance and timing recommendations</li>
            <li>interpretation guidelines</li>
            <li>research citations</li>
          </ul>
          <p>
            these documentation pages provide everything you need to implement
            measures in your own survey platform (Qualtrics, Google Forms,
            etc.) and interpret results. this approach gives you flexibility to
            integrate measures into your existing assessment infrastructure.
          </p>
          <h3>available measure documentation</h3>
          <ul>
            <li>
              self-report surveys (intellectual humility, TIPI openness,
              curiosity, adaptability, creativity)
            </li>
            <li>
              situational judgment tasks (cross-cultural adaptability,
              emotional intelligence, communities of practice)
            </li>
            <li>
              rubrics and coding schemes for analyzing student artifacts and
              reflections
            </li>
          </ul>
          <p>
            <strong>support</strong>: contact the PRME Pedagogy team or
            winded.vertigo for assistance selecting measures, interpreting
            results, or designing your evidence collection approach.
          </p>
          <p>
            for the December 11 Implement Session, we will model how to select
            and use these measures and provide space for you to identify which
            best fit your lesson plans and pedagogical goals.
          </p>

          <Divider />

          <h2>references &amp; further reading</h2>
          <p>
            this primer draws on extensive research in learning sciences,
            creativity, social-emotional learning, and pedagogy. key frameworks
            and research informing this work include:
          </p>
          <h3>frameworks</h3>
          <ul className={styles.references}>
            <li>
              PRME Holistic Skills Framework (developed with winded.vertigo,
              2024–2025)
            </li>
            <li>
              CASEL Social-Emotional Learning Framework (Collaborative for
              Academic, Social, and Emotional Learning)
            </li>
            <li>UNESCO SDG4 Framework (Education for Sustainable Development)</li>
          </ul>
          <h3>key research</h3>
          <ul className={styles.references}>
            <li>
              Davis, M. H. (1983). Measuring individual differences in empathy:
              Evidence for a multidimensional approach.{" "}
              <em>Journal of Personality and Social Psychology</em>, 44(1),
              113–126.
            </li>
            <li>
              Fung, W. K., &amp; Chung, K. K. H. (2025). Playfulness and
              longitudinal development in creative thinking and academic skills
              among kindergarten children.{" "}
              <em>Journal of Creative Behavior</em>.
            </li>
            <li>
              Gosling, S. D., Rentfrow, P. J., &amp; Swann, W. B. (2003). A very
              brief measure of the Big-Five personality domains.{" "}
              <em>Journal of Research in Personality</em>, 37(6), 504–528.
            </li>
            <li>
              Kashdan, T. B., et al. (2009). The Curiosity and Exploration
              Inventory-II: Development, factor structure, and psychometrics.{" "}
              <em>Journal of Research in Personality</em>, 43(6), 987–998.
            </li>
            <li>
              Leary, M. R., et al. (2017). Cognitive and interpersonal features
              of intellectual humility.{" "}
              <em>Personality and Social Psychology Bulletin</em>, 43(6),
              793–813.
            </li>
            <li>
              OECD. (2019). <em>PISA 2021 creative thinking framework</em>.
              OECD Publishing.
            </li>
            <li>
              Parker, R., &amp; Thomsen, B. S. (2022). Learning through play at
              school: A framework for policy and practice.{" "}
              <em>Frontiers in Education</em>, 7, 751801.
            </li>
            <li>
              Rotter, J. B. (1966). Generalized expectancies for internal
              versus external control of reinforcement.{" "}
              <em>Psychological Monographs: General and Applied</em>, 80(1),
              1–28.
            </li>
            <li>
              Skene, K., et al. (2022). Can guidance during play enhance
              children’s learning and development in educational contexts? A
              systematic review and meta-analysis.{" "}
              <em>Child Development</em>, 93(4), 1162–1180.
            </li>
            <li>
              Sosu, E. M. (2013). The development and psychometric validation
              of a Critical Thinking Disposition Scale.{" "}
              <em>Thinking Skills and Creativity</em>, 9, 107–119.
            </li>
            <li>
              Soto, C. J., &amp; John, O. P. (2017). Short and extra-short forms
              of the Big Five Inventory–2: The BFI-2-S and BFI-2-XS.{" "}
              <em>Journal of Research in Personality</em>, 68, 69–81.
            </li>
            <li>
              Zosh, J. M., et al. (2020).{" "}
              <em>
                A new path to education reform: Playful learning promotes
                21st-century skills in schools and beyond
              </em>
              . Brookings Institution.
            </li>
          </ul>

          <p>
            <strong>questions or need support?</strong> reach out to the PRME
            Pedagogy team or the winded.vertigo collective. we’re here to help
            you design for holistic skills development and capture meaningful
            evidence of student growth.
          </p>
        </article>
      </div>
    </div>
  );
}
