// Fake @minecraft/server-ui: forms answer with the next queued selection (or cancel).
export class ActionFormData {
  constructor() {
    this.buttons = [];
  }
  title(t) {
    this._title = t;
    return this;
  }
  body(b) {
    this._body = b;
    return this;
  }
  button(text) {
    this.buttons.push(text);
    return this;
  }
  show() {
    const S = globalThis.__mc;
    S.forms.push({ title: this._title, body: this._body, buttons: this.buttons });
    const selection = S.formQueue.shift();
    return Promise.resolve(selection === undefined ? { canceled: true } : { canceled: false, selection });
  }
}
