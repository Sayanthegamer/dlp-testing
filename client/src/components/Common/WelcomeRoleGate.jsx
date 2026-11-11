import React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * Unslopped WelcomeRoleGate:
 * - Task-first language ("Assessments for your classroom") instead of infrastructure buzzwords.
 * - One clear primary entry point per role, with secondary registration links.
 * - Uses shared semantic Tailwind tokens (`bg-paper-200`, `bg-exam-card`, `text-exam-ink`, `border-exam-border`)
 *   and clear 16px/14px typographic hierarchy without decorative badges, pills, or checklists.
 */
export default function WelcomeRoleGate({
  onSelectStudent,
  onSelectTeacher,
  onLaunchStudentDemo,
  onLaunchTeacherDemo,
}) {
  const isDevEnv = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

  return (
    <div className="min-h-screen bg-paper-200 flex flex-col justify-between font-sans text-exam-ink selection:bg-paper-300">
      {/* Quiet Top Bar */}
      <header className="border-b border-exam-border bg-exam-card">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-exam-ink text-exam-card flex items-center justify-center font-serif text-base font-medium">
              ∑
            </div>
            <span className="font-serif font-medium text-base text-exam-ink tracking-tight">
              Tuition Assessment
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={onLaunchStudentDemo}
              className="text-exam-secondary hover:text-exam-ink transition-calm"
            >
              Try a sample paper
            </button>
            {isDevEnv && (
              <button
                type="button"
                onClick={onLaunchTeacherDemo}
                className="text-exam-muted hover:text-exam-ink transition-calm"
              >
                Local teacher sandbox
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Task Entry Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 sm:py-16 flex flex-col justify-center">
        <div className="max-w-xl mb-10 space-y-3">
          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-exam-ink tracking-tight">
            Assessments for your classroom
          </h1>
          <p className="text-base text-exam-secondary leading-relaxed">
            Teachers: prepare and publish a paper. Students: sign in with your roll number to take your test.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
          {/* Student Entry Card */}
          <section className="exam-paper rounded-lg p-6 sm:p-8 flex flex-col justify-between gap-8">
            <div className="space-y-3">
              <span className="text-sm font-medium text-exam-muted block">
                Students
              </span>
              <h2 className="text-2xl font-serif font-normal text-exam-ink">
                Take an exam
              </h2>
              <p className="text-base text-exam-secondary leading-relaxed">
                Sign in with your roll number and date of birth to enter a 6-digit session code or view past scorecards.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-exam-border">
              <button
                type="button"
                onClick={() => onSelectStudent({ tab: 'login' })}
                className="w-full h-11 px-4 rounded-md bg-exam-ink hover:opacity-90 text-exam-card text-sm font-medium transition-calm flex items-center justify-between"
              >
                <span>Student sign in</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </button>

              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-exam-muted">First time taking a test?</span>
                <button
                  type="button"
                  onClick={() => onSelectStudent({ tab: 'signup' })}
                  className="font-medium text-exam-accent hover:underline"
                >
                  Register or join a class
                </button>
              </div>
            </div>
          </section>

          {/* Teacher Entry Card */}
          <section className="exam-paper rounded-lg p-6 sm:p-8 flex flex-col justify-between gap-8">
            <div className="space-y-3">
              <span className="text-sm font-medium text-exam-muted block">
                Teachers
              </span>
              <h2 className="text-2xl font-serif font-normal text-exam-ink">
                Prepare and grade papers
              </h2>
              <p className="text-base text-exam-secondary leading-relaxed">
                Import or write questions, start a live session code for your classroom, and review student submissions.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-exam-border">
              <button
                type="button"
                onClick={() => onSelectTeacher({ mode: 'login' })}
                className="w-full h-11 px-4 rounded-md bg-exam-ink hover:opacity-90 text-exam-card text-sm font-medium transition-calm flex items-center justify-between"
              >
                <span>Teacher sign in</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </button>

              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-exam-muted">Setting up a new classroom?</span>
                <button
                  type="button"
                  onClick={() => onSelectTeacher({ mode: 'signup' })}
                  className="font-medium text-exam-accent hover:underline"
                >
                  Create teacher account
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-exam-border bg-exam-card py-4 text-sm text-exam-muted">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <span>Tuition Assessment</span>
          <button
            type="button"
            onClick={onLaunchStudentDemo}
            className="text-exam-secondary hover:text-exam-ink transition-calm"
          >
            Sample practice paper
          </button>
        </div>
      </footer>
    </div>
  );
}
