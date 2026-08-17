export class LatestOperation {
  private version = 0

  begin(): number {
    this.version += 1
    return this.version
  }

  cancel(): void {
    this.version += 1
  }

  isCurrent(version: number): boolean {
    return version === this.version
  }
}
