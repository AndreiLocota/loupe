export type EventCallback<T> = (event: T) => void;

export class EventBus<T> {
  private listeners = new Set<EventCallback<T>>();

  subscribe(callback: EventCallback<T>): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  emit(event: T): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors so one bad listener doesn't break others.
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}
