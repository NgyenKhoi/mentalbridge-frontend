export default class FailOnUnexpectedSkipReporter {
  skipped = []

  onTestEnd(test, result) {
    if (
      result.status === 'skipped' &&
      test.annotations.some((annotation) => annotation.type === 'skip') &&
      test.annotations.some(
        (annotation) =>
          annotation.type === 'skip' &&
          (!annotation.description || annotation.description.trim() === ''),
      ) &&
      process.env.E2E_RUNTIME !== 'live-cross-stack'
    ) {
      this.skipped.push(test.titlePath().join(' › '))
    }
  }

  onEnd() {
    if (this.skipped.length === 0) return

    console.error(
      `Unexpected skipped Playwright tests (${this.skipped.length}):\n- ${this.skipped.join('\n- ')}`,
    )
    process.exitCode = 1
  }
}
