import { UserSession, UserState } from '../types/bot';

export class SessionManager {
  private sessions: Map<number, UserSession> = new Map();

  public getSession(userId: number): UserSession {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        userId,
        state: UserState.IDLE,
        data: {},
        lastActivity: new Date()
      });
    }
    return this.sessions.get(userId)!;
  }

  public updateState(userId: number, state: UserState): void {
    const session = this.getSession(userId);
    session.state = state;
    session.lastActivity = new Date();
  }

  public updateData(userId: number, data: Record<string, any>): void {
    const session = this.getSession(userId);
    session.data = { ...session.data, ...data };
    session.lastActivity = new Date();
  }

  public clearData(userId: number): void {
    const session = this.getSession(userId);
    session.data = {};
    session.lastActivity = new Date();
  }

  public resetSession(userId: number): void {
    this.sessions.set(userId, {
      userId,
      state: UserState.IDLE,
      data: {},
      lastActivity: new Date()
    });
  }

  public getData(userId: number, key: string): any {
    const session = this.getSession(userId);
    return session.data[key];
  }

  public setData(userId: number, key: string, value: any): void {
    const session = this.getSession(userId);
    session.data[key] = value;
    session.lastActivity = new Date();
  }

  public isInState(userId: number, state: UserState): boolean {
    const session = this.getSession(userId);
    return session.state === state;
  }

  public cleanupInactiveSessions(maxAgeMinutes: number = 60): void {
    const now = new Date();
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds

    for (const [userId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > maxAge) {
        this.sessions.delete(userId);
      }
    }
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  public getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }
}
