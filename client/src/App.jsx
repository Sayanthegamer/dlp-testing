import React, { useState } from 'react';
import WelcomeRoleGate from './components/Common/WelcomeRoleGate';
import TeacherWorkspaceShell from './components/TeacherDashboard/TeacherWorkspaceShell';
import StudentExamShell from './components/Student/StudentExamShell';
import { getStoredStudentProfile } from './services/apiService';
import { repairMissingMathBackslashes } from './services/mathSanitizerService';

function sanitizeQuestionsList(qList = []) {
  if (!Array.isArray(qList)) return [];
  return qList.map((q) => ({
    ...q,
    questionText:
      typeof q.questionText === 'string'
        ? repairMissingMathBackslashes(q.questionText)
        : q.questionText,
    options: Array.isArray(q.options)
      ? q.options.map((opt) =>
          typeof opt === 'string' ? repairMissingMathBackslashes(opt) : opt
        )
      : q.options,
  }));
}

const INITIAL_CATALOGUE = {
  testTitle: 'Higher Secondary Mathematics — Unit Assessment',
  questions: [
    {
      id: 'q_init_1',
      questionText:
        'Find all real roots of the quadratic equation <math>x^2 + 2x - 3 = 0</math>.',
      type: 'mcq',
      options: [
        '<math>x = 1, -3</math>',
        '<math>x = -1, 3</math>',
        '<math>x = 2, -3</math>',
        '<math>x = -2, 1</math>',
      ],
      correctAnswer: 0,
      mathSpans: ['x^2 + 2x - 3 = 0', 'x = 1, -3'],
      confidenceScore: 0.98,
      needsReview: false,
    },
    {
      id: 'q_init_2',
      questionText:
        'Evaluate the definite integral <math>\\int_{0}^{1} (3x^2 + 1) \\, dx</math>.',
      type: 'short_answer_numeric',
      options: [],
      correctAnswer: 2,
      acceptedRange: [1.98, 2.02],
      numericalConfirmed: true,
      mathSpans: ['\\int_{0}^{1} (3x^2 + 1) \\, dx'],
      confidenceScore: 0.97,
      needsReview: false,
    },
  ],
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(localStorage.getItem('teacher_auth_token'))
  );
  const [testTitle, setTestTitle] = useState(INITIAL_CATALOGUE.testTitle);
  const [questions, setQuestions] = useState(INITIAL_CATALOGUE.questions);
  const [publishedExamInfo, setPublishedExamInfo] = useState(null);

  const searchParams = new URLSearchParams(window.location.search);
  const isStudentUrl =
    searchParams.get('mode') === 'student' ||
    Boolean(searchParams.get('classCode')) ||
    Boolean(searchParams.get('adm'));
  const isTeacherUrl = searchParams.get('mode') === 'teacher';

  const [studentAuthInitialTab, setStudentAuthInitialTab] = useState(
    () => searchParams.get('tab') || 'login'
  );
  const [studentAuthClassCode, setStudentAuthClassCode] = useState(
    () => searchParams.get('classCode') || ''
  );
  const [teacherAuthInitialMode, setTeacherAuthInitialMode] = useState('login');
  const [targetTestId, setTargetTestId] = useState(
    () => searchParams.get('testId') || searchParams.get('examId') || ''
  );

  const [viewMode, setViewMode] = useState(() => {
    if (isStudentUrl) return 'student_portal';
    if (isTeacherUrl) return 'teacher';
    if (localStorage.getItem('teacher_auth_token')) return 'teacher';
    if (getStoredStudentProfile()) return 'student_portal';
    return 'role_gate';
  });

  const [studentUser, setStudentUser] = useState(() => getStoredStudentProfile());
  const [isDevDemo, setIsDevDemo] = useState(false);

  const handleResetCatalogue = () => {
    setTestTitle(INITIAL_CATALOGUE.testTitle);
    setQuestions(INITIAL_CATALOGUE.questions);
  };

  if (viewMode === 'role_gate') {
    return (
      <WelcomeRoleGate
        onSelectStudent={({ tab = 'login', classCode = '' } = {}) => {
          setStudentAuthInitialTab(tab);
          setStudentAuthClassCode(classCode);
          setViewMode('student_portal');
        }}
        onSelectTeacher={({ mode = 'login' } = {}) => {
          setTeacherAuthInitialMode(mode);
          setViewMode('teacher');
        }}
        onLaunchStudentDemo={() => {
          setIsDevDemo(true);
          setStudentUser({
            id: 'dev_demo_candidate',
            admission_number: 'DLP-26-DEMO',
            full_name: 'Arjun Sen',
            dob: '2008-05-14',
          });
          setViewMode('student_portal');
        }}
        onLaunchTeacherDemo={() => {
          localStorage.setItem('teacher_auth_token', 'dev-fallback-token');
          setIsAuthenticated(true);
          setViewMode('teacher');
        }}
      />
    );
  }

  if (viewMode === 'student_portal') {
    return (
      <StudentExamShell
        studentUser={studentUser}
        onSetStudentUser={setStudentUser}
        isDevDemo={isDevDemo}
        onSetIsDevDemo={setIsDevDemo}
        studentAuthInitialTab={studentAuthInitialTab}
        studentAuthClassCode={studentAuthClassCode}
        targetTestId={targetTestId}
        onSetTargetTestId={setTargetTestId}
        publishedExamInfo={publishedExamInfo}
        testTitle={testTitle}
        onSetTestTitle={setTestTitle}
        questions={questions}
        onSetQuestions={setQuestions}
        sanitizeQuestionsList={sanitizeQuestionsList}
        onBackToRoleGate={() => setViewMode('role_gate')}
        onSwitchToTeacher={() => setViewMode('teacher')}
      />
    );
  }

  return (
    <TeacherWorkspaceShell
      isAuthenticated={isAuthenticated}
      onSetAuthenticated={setIsAuthenticated}
      teacherAuthInitialMode={teacherAuthInitialMode}
      testTitle={testTitle}
      onSetTestTitle={setTestTitle}
      questions={questions}
      onSetQuestions={setQuestions}
      sanitizeQuestionsList={sanitizeQuestionsList}
      onResetCatalogue={handleResetCatalogue}
      publishedExamInfo={publishedExamInfo}
      onSetPublishedExamInfo={setPublishedExamInfo}
      onBackToRoleGate={() => setViewMode('role_gate')}
      onSwitchToStudentPortal={() => setViewMode('student_portal')}
    />
  );
}
