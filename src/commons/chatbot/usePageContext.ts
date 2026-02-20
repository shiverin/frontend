import { useLocation } from 'react-router';
import { useTypedSelector } from 'src/commons/utils/Hooks';

import { EditorTabState } from '../workspace/WorkspaceTypes';

/**
 * Hook that captures real visible content from the current page for the Pixel chatbot.
 * Pulls editor code from Redux workspace state, assessment question text from session state,
 * and grading submission data — so the AI knows exactly what the user is seeing.
 */
export function usePageContext(): { pageContext: string; pageType: string } {
  const location = useLocation();
  const pathname = location.pathname;

  // Workspace editor states
  const playgroundEditorTabs = useTypedSelector(state => state.workspaces.playground.editorTabs);
  const playgroundActiveTab = useTypedSelector(
    state => state.workspaces.playground.activeEditorTabIndex
  );
  const playgroundOutput = useTypedSelector(state => state.workspaces.playground.output);
  const playgroundReplValue = useTypedSelector(state => state.workspaces.playground.replValue);

  const assessmentEditorTabs = useTypedSelector(state => state.workspaces.assessment.editorTabs);
  const assessmentActiveTab = useTypedSelector(
    state => state.workspaces.assessment.activeEditorTabIndex
  );
  const currentAssessmentId = useTypedSelector(
    state => state.workspaces.assessment.currentAssessment
  );
  const currentAssessmentQuestion = useTypedSelector(
    state => state.workspaces.assessment.currentQuestion
  );

  const gradingEditorTabs = useTypedSelector(state => state.workspaces.grading.editorTabs);
  const gradingActiveTab = useTypedSelector(
    state => state.workspaces.grading.activeEditorTabIndex
  );
  const currentSubmissionId = useTypedSelector(
    state => state.workspaces.grading.currentSubmission
  );
  const currentGradingQuestion = useTypedSelector(
    state => state.workspaces.grading.currentQuestion
  );

  // Session data
  const assessments = useTypedSelector(state => state.session.assessments);
  const gradings = useTypedSelector(state => state.session.gradings);

  const { pageType, pageContext } = buildPageContext(pathname, {
    playgroundEditorTabs,
    playgroundActiveTab,
    playgroundOutput,
    playgroundReplValue,
    assessmentEditorTabs,
    assessmentActiveTab,
    currentAssessmentId,
    currentAssessmentQuestion,
    gradingEditorTabs,
    gradingActiveTab,
    currentSubmissionId,
    currentGradingQuestion,
    assessments,
    gradings
  });

  return { pageContext, pageType };
}

/** Extract the code from the active editor tab, or concatenate all tabs if none is active. */
function getEditorCode(
  editorTabs: readonly EditorTabState[],
  activeTab: number | null
): string | undefined {
  if (editorTabs.length === 0) return undefined;

  if (activeTab !== null && editorTabs[activeTab]) {
    return editorTabs[activeTab].value;
  }

  // Fallback: join all tab values
  const allCode = editorTabs.map((tab, i) => `// Tab ${i + 1}\n${tab.value}`).join('\n\n');
  return allCode || undefined;
}

/** Truncate long strings to keep context within reasonable token limits. */
function truncate(text: string, maxLen: number = 3000): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n... [truncated]';
}

/** Strip HTML tags from assessment question content for cleaner context. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

type StoreSlices = {
  playgroundEditorTabs: readonly EditorTabState[];
  playgroundActiveTab: number | null;
  playgroundOutput: readonly any[];
  playgroundReplValue: string;
  assessmentEditorTabs: readonly EditorTabState[];
  assessmentActiveTab: number | null;
  currentAssessmentId: number | undefined;
  currentAssessmentQuestion: number | undefined;
  gradingEditorTabs: readonly EditorTabState[];
  gradingActiveTab: number | null;
  currentSubmissionId: number | undefined;
  currentGradingQuestion: number | undefined;
  assessments: Record<number, any>;
  gradings: Record<number, any>;
};

function buildPageContext(
  pathname: string,
  store: StoreSlices
): { pageType: string; pageContext: string } {
  // ── Playground ──
  if (pathname.startsWith('/playground')) {
    const code = getEditorCode(store.playgroundEditorTabs, store.playgroundActiveTab);
    const parts = [
      'The user is currently on the Source Academy Playground — an interactive code editor for the Source language (a subset of JavaScript).',
      `Route: ${pathname}`
    ];
    if (code) {
      parts.push(`\nThe user's current code in the editor:\n\`\`\`javascript\n${truncate(code)}\n\`\`\``);
    }
    if (store.playgroundReplValue) {
      parts.push(`\nThe user's current REPL input: ${store.playgroundReplValue}`);
    }
    if (store.playgroundOutput.length > 0) {
      const outputTexts = store.playgroundOutput
        .slice(-10)
        .map((o: any) =>
          o.type === 'result' ? String(o.value) : o.type === 'errors' ? o.errors : String(o)
        )
        .join('\n');
      parts.push(`\nRecent program output:\n${truncate(outputTexts, 1000)}`);
    }
    return { pageType: 'playground', pageContext: parts.join('\n') };
  }

  // ── Academy sub-routes ──
  const courseMatch = pathname.match(/^\/courses\/(\d+)\/(.*)/);
  if (courseMatch) {
    const subPath = courseMatch[2];

    // Grading page
    if (subPath.startsWith('grading')) {
      const parts = [
        'The user is on the Grading page — a staff view for reviewing student submissions.',
        `Route: ${pathname}`
      ];
      if (store.currentSubmissionId != null && store.gradings[store.currentSubmissionId]) {
        const grading = store.gradings[store.currentSubmissionId];
        const answers = grading?.answers;
        if (answers && store.currentGradingQuestion != null) {
          const gq = answers[store.currentGradingQuestion];
          if (gq) {
            if (gq.question?.content) {
              parts.push(
                `\nQuestion being graded:\n${truncate(stripHtml(gq.question.content), 1500)}`
              );
            }
            if (gq.question?.answer != null) {
              parts.push(
                `\nStudent's submitted answer:\n\`\`\`javascript\n${truncate(String(gq.question.answer))}\n\`\`\``
              );
            }
            if (gq.grade?.comments) {
              parts.push(`\nGrader comments so far: ${gq.grade.comments}`);
            }
            if (gq.student) {
              parts.push(`\nStudent: ${gq.student.name} (${gq.student.username})`);
            }
          }
        }
      }
      const gradingCode = getEditorCode(store.gradingEditorTabs, store.gradingActiveTab);
      if (gradingCode) {
        parts.push(
          `\nCode currently visible in the grading editor:\n\`\`\`javascript\n${truncate(gradingCode)}\n\`\`\``
        );
      }
      return { pageType: 'grading', pageContext: parts.join('\n') };
    }

    if (subPath.startsWith('groundcontrol')) {
      return {
        pageType: 'groundcontrol',
        pageContext: `The user is on Ground Control — a staff management page for assessments.\nRoute: ${pathname}`
      };
    }

    if (subPath.startsWith('adminpanel')) {
      return {
        pageType: 'adminpanel',
        pageContext: `The user is on the Admin Panel — course administration settings.\nRoute: ${pathname}`
      };
    }

    if (subPath.startsWith('achievements')) {
      return {
        pageType: 'achievements',
        pageContext: `The user is on the Achievements page — gamification and goals tracking.\nRoute: ${pathname}`
      };
    }

    if (subPath.startsWith('sourcecast')) {
      return {
        pageType: 'sourcecast',
        pageContext: `The user is on the Sourcecast page — recorded coding sessions.\nRoute: ${pathname}`
      };
    }

    if (subPath.startsWith('game')) {
      return {
        pageType: 'game',
        pageContext: `The user is on the Game page — the Source Academy story game.\nRoute: ${pathname}`
      };
    }

    if (subPath.startsWith('stories')) {
      return {
        pageType: 'stories',
        pageContext: `The user is on the Stories page — story management for the game.\nRoute: ${pathname}`
      };
    }

    // Assessment pages (missions, quests, paths, etc.)
    const parts = [
      'The user is on an assessment page (mission, quest, path, or other assignment type).',
      `Route: ${pathname}`
    ];
    if (store.currentAssessmentId != null && store.assessments[store.currentAssessmentId]) {
      const assessment = store.assessments[store.currentAssessmentId];
      if (assessment.title) {
        parts.push(`\nAssessment title: ${assessment.title}`);
      }
      if (assessment.longSummary) {
        parts.push(`\nAssessment summary: ${truncate(stripHtml(assessment.longSummary), 800)}`);
      }
      if (
        store.currentAssessmentQuestion != null &&
        assessment.questions?.[store.currentAssessmentQuestion]
      ) {
        const question = assessment.questions[store.currentAssessmentQuestion];
        if (question.content) {
          parts.push(
            `\nCurrent question (Q${store.currentAssessmentQuestion + 1}):\n${truncate(stripHtml(question.content), 1500)}`
          );
        }
        if (question.type === 'programming' && question.answer != null) {
          parts.push(
            `\nStudent's current answer code:\n\`\`\`javascript\n${truncate(String(question.answer))}\n\`\`\``
          );
        }
      }
    }
    const assessmentCode = getEditorCode(store.assessmentEditorTabs, store.assessmentActiveTab);
    if (assessmentCode) {
      parts.push(
        `\nCode currently in the assessment editor:\n\`\`\`javascript\n${truncate(assessmentCode)}\n\`\`\``
      );
    }
    return { pageType: 'assessment', pageContext: parts.join('\n') };
  }

  // ── Mission control ──
  if (pathname.startsWith('/mission-control')) {
    return {
      pageType: 'mission-control',
      pageContext: `The user is on Mission Control — assessment management interface.\nRoute: ${pathname}`
    };
  }

  // ── Contributors ──
  if (pathname.startsWith('/contributors')) {
    return {
      pageType: 'contributors',
      pageContext: `The user is on the Contributors page — listing Source Academy contributors.\nRoute: ${pathname}`
    };
  }

  // ── Welcome ──
  if (pathname.startsWith('/welcome')) {
    return {
      pageType: 'welcome',
      pageContext: `The user is on the Welcome page — initial setup after login.\nRoute: ${pathname}`
    };
  }

  // ── Default ──
  return {
    pageType: 'general',
    pageContext: `The user is browsing Source Academy.\nRoute: ${pathname}`
  };
}

export default usePageContext;
