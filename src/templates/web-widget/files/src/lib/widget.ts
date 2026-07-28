export type DemoWidgetOptions = {
	readonly title?: string;
	readonly message?: string;
	readonly actionLabel?: string;
	readonly onAction?: (count: number) => void | Promise<void>;
};

export type DemoWidgetInstance = {
	readonly increment: () => Promise<void>;
	readonly setMessage: (message: string) => void;
	readonly destroy: () => void;
};

const DEFAULT_TITLE = 'Native Widget';
const DEFAULT_MESSAGE = 'Ready to publish on npm.';
const DEFAULT_ACTION_LABEL = 'Increment';

export class DemoWidget implements DemoWidgetInstance {
	readonly #host: HTMLElement;
	readonly #root: HTMLDivElement;
	readonly #message: HTMLParagraphElement;
	readonly #button: HTMLButtonElement;
	readonly #onAction: ((count: number) => void | Promise<void>) | undefined;
	#count = 0;
	#destroyed = false;

	public constructor(host: HTMLElement, options: DemoWidgetOptions = {}) {
		this.#host = host;
		this.#onAction = options.onAction;
		this.#root = document.createElement('div');
		this.#root.className = 'widget';

		const title = document.createElement('h2');
		title.className = 'widget__title';
		title.textContent = options.title ?? DEFAULT_TITLE;

		this.#message = document.createElement('p');
		this.#message.className = 'widget__message';
		this.#message.textContent = options.message ?? DEFAULT_MESSAGE;

		this.#button = document.createElement('button');
		this.#button.className = 'widget__button';
		this.#button.type = 'button';
		this.#button.textContent = options.actionLabel ?? DEFAULT_ACTION_LABEL;
		this.#button.addEventListener('click', this.#handleClick);

		this.#root.append(title, this.#message, this.#button);
		this.#host.append(this.#root);
	}

	public readonly increment = async (): Promise<void> => {
		this.#assertActive();
		this.#count += 1;
		this.#message.textContent = `Clicked ${this.#count} time${this.#count === 1 ? '' : 's'}.`;
		await this.#onAction?.(this.#count);
	};

	public readonly setMessage = (message: string): void => {
		this.#assertActive();
		this.#message.textContent = message;
	};

	public readonly destroy = (): void => {
		if (this.#destroyed) {
			return;
		}
		this.#button.removeEventListener('click', this.#handleClick);
		this.#root.remove();
		this.#destroyed = true;
	};

	readonly #handleClick = (): void => {
		void this.increment();
	};

	#assertActive(): void {
		if (this.#destroyed) {
			throw new Error('Widget has been destroyed.');
		}
	}
}

export const createWidget = (host: HTMLElement, options?: DemoWidgetOptions): DemoWidgetInstance => new DemoWidget(host, options);
