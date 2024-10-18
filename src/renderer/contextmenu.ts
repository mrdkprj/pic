type Size = {
    bottom: number;
    width: number;
    height: number;
};

const menuItemHeight = 29;
const separatorHeight = 1;

export class ContextMenu {
    private options: Pic.ContextMenu[];
    private menu: HTMLElement;
    private size = {
        innerHeight: 0,
        outerHeight: 0,
        innerWidth: 0,
        outerWidth: 0,
    };
    private submenuSize: { [key: string]: Size } = {};
    private complete = true;
    private handler: (e: Pic.ContextMenuClickEvent) => void;
    private initiator: HTMLElement;
    open = false;

    constructor(options?: Pic.ContextMenu[]) {
        if (options) {
            this.options = options;
            this.build(this.options);
        }
    }

    onClick(handler: (e: Pic.ContextMenuClickEvent) => void) {
        this.handler = handler;
    }

    popup = (e: MouseEvent) => {
        if (!this.menu) return;

        this._popup(e);

        this.menu.focus();
        this.menu.addEventListener("blur", this.hide);
    };

    private _popup(e: MouseEvent) {
        this.menu.style.display = "flex";
        this.open = true;

        this.menu.classList.remove("revert");

        if (e.clientY + this.size.outerHeight <= document.documentElement.clientHeight) {
            this.menu.style.top = `${e.clientY}px`;
        } else {
            this.menu.style.top = `${e.clientY - this.size.innerHeight}px`;
        }

        if (e.clientX + this.size.outerWidth <= document.documentElement.clientWidth) {
            this.menu.style.left = `${e.clientX}px`;
        } else {
            this.menu.classList.add("revert");
            this.menu.style.left = `${e.clientX - this.size.innerWidth}px`;
        }
    }

    hide = () => {
        if (!this.menu) return;

        this._hide();
        this.menu.removeEventListener("blur", this.hide);
    };

    private _hide = () => {
        this.open = false;
        this.menu.style.display = "none";
    };

    toggle = (e: MouseEvent) => {
        if (!this.menu) return;

        if (this.open) {
            this._hide();
        } else {
            this._popup(e);
            this.initiator = e.target as HTMLElement;
            this.initiator.focus();
            this.initiator.removeEventListener("blur", this._hide);
            this.initiator.addEventListener("blur", this._hide);
        }
    };

    build(options: Pic.ContextMenu[]) {
        this.options = options;

        this.menu = document.createElement("div");
        this.menu.classList.add("menu-container");
        this.menu.setAttribute("menu", "");
        this.menu.tabIndex = 0;
        this.menu.style.top = "0px";
        this.menu.style.left = "0px";
        this.menu.style.visibility = "hidden";

        this.options.forEach((menuItem) => {
            this.menu.append(this.createMenu(menuItem));
            this.size.innerHeight += menuItemHeight;
        });

        document.body.append(this.menu);

        this.setSize();

        this.menu.style.visibility = "";
        this.menu.style.display = "none";
    }

    private setSize = () => {
        const menuRect = this.menu.getBoundingClientRect();
        this.size.innerHeight = menuRect.height;
        this.size.innerWidth = menuRect.width;
        this.size.outerHeight = menuRect.height;
        this.size.outerWidth = menuRect.width;

        const keys = Object.keys(this.submenuSize);

        const overflowItems = keys.filter((key) => this.submenuSize[key].bottom > this.size.innerHeight);
        if (overflowItems.length) {
            const highestChild = overflowItems.reduce((a, b) => (this.submenuSize[a].bottom > this.submenuSize[b].bottom ? a : b));
            this.size.outerHeight = this.submenuSize[highestChild].bottom;
        }

        const widestChild = Object.keys(this.submenuSize).reduce((a, b) => (this.submenuSize[a].width > this.submenuSize[b].width ? a : b));
        const widestSubmenu = this.menu.querySelector(`#${widestChild}`)?.querySelector(".submenu");
        if (widestSubmenu) {
            const submenuRect = widestSubmenu.getBoundingClientRect();
            this.size.outerWidth = this.size.innerWidth + submenuRect.width;
        }
    };

    private createId() {
        return "menu" + crypto.randomUUID();
    }

    private createMenu(menuItem: Pic.ContextMenu): Node {
        if (menuItem.type == "checkbox") {
            return this.createCheckboxMenu(menuItem);
        }

        if (menuItem.type == "radio") {
            return this.createCheckboxMenu(menuItem);
        }

        if (menuItem.type == "separator") {
            return this.createSeparator();
        }

        if (menuItem.submenu) {
            return this.createSubmenu(menuItem, menuItem.submenu);
        }

        const menu = document.createElement("div");
        menu.id = this.createId();
        menu.classList.add("menu-item");
        menu.setAttribute("name", menuItem.name);
        menu.setAttribute("data-type", menuItem.type ?? "text");
        menu.setAttribute("data-value", menuItem.value ?? "");
        menu.textContent = menuItem.label ?? "";
        this.setupMenu(menu);

        return menu;
    }

    private createSubmenu(submenuItem: Pic.ContextMenu, submenuMenuItems: Pic.ContextMenu[]) {
        const container = document.createElement("div");
        container.id = this.createId();
        container.classList.add("submenu-container", "menu-item");
        container.addEventListener("mouseenter", this.onSubmenuMouseEnter);

        const header = document.createElement("div");
        header.classList.add("submenu-header");
        header.textContent = submenuItem.label ?? "";
        container.append(header);

        const submenu = document.createElement("div");
        submenu.classList.add("submenu");
        submenu.setAttribute("menu", "");
        const menus = submenuMenuItems.map((menuItem) => this.createMenu(menuItem));
        submenu.append(...menus);
        container.append(submenu);

        this.submenuSize[container.id] = this.getSubmenuSize(submenuMenuItems);

        this.setupMenu(container);

        return container;
    }

    private getSubmenuSize(submenuMenuItems: Pic.ContextMenu[]) {
        let height = 0;
        let width = 0;
        submenuMenuItems.forEach((item) => {
            if (item.type === "separator") {
                height += separatorHeight;
            } else {
                height += menuItemHeight;
            }

            if (item.label) {
                width = width > item.label.length ? item.label.length : width;
            }
        });

        const bottom = this.size.innerHeight + height;
        return { bottom, width, height };
    }

    private onSubmenuMouseEnter = (e: MouseEvent) => {
        if (this.complete) return;

        const target = e.target as HTMLElement;

        const bottom = e.clientY + this.submenuSize[target.id].height;
        const overflow = bottom - document.documentElement.clientHeight;
        const submenu = target.querySelector(".submenu") as HTMLElement;
        if (overflow > 0) {
            submenu.style.top = `${-overflow}px`;
        } else {
            submenu.style.top = "0px";
        }

        this.complete = true;
    };

    private createCheckboxMenu(menuItem: Pic.ContextMenu) {
        const menu = document.createElement("div");
        menu.id = this.createId();
        menu.classList.add("checkbox-menu", "menu-item");
        menu.tabIndex = 0;
        menu.setAttribute("name", menuItem.name);
        menu.setAttribute("data-type", menuItem.type ?? "text");
        menu.setAttribute("data-value", menuItem.value ?? "");
        menu.textContent = menuItem.label ?? "";

        if (menuItem.checked) {
            menu.setAttribute("checked", "");
        }

        this.setupMenu(menu);

        return menu;
    }

    private setupMenu(menu: HTMLDivElement) {
        menu.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
        });
        menu.addEventListener("mouseup", this.onMenuItemClick);
    }

    private createSeparator() {
        this.size.innerHeight += separatorHeight;
        const separator = document.createElement("div");
        separator.classList.add("menu-separator");
        return separator;
    }

    private onMenuItemClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        const targetType = target.getAttribute("data-type");

        if (!targetType) return;

        if (targetType == "submenu") return;

        if (targetType == "checkbox" || targetType == "radio") {
            this.toggleCheck(e);
        }

        if (this.handler) {
            this.handler({ name: target.getAttribute("name") as Pic.ContextMenuNames, value: target.getAttribute("data-value") as Pic.ContextMenuOptions });
        }

        this.hide();
    };

    private toggleCheck(e: MouseEvent) {
        const target = e.target as HTMLElement;

        if (target.getAttribute("data-type") == "radio") {
            return this.toggleRadio(target);
        }

        if (target.hasAttribute("checked")) {
            target.removeAttribute("checked");
        } else {
            target.setAttribute("checked", "");
        }
    }

    private toggleRadio(target: HTMLElement) {
        const parent = target.parentElement;

        if (!parent?.hasAttribute("menu")) return;

        Array.from(parent.children).forEach((menu) => {
            if (menu.id != target.id) {
                menu.removeAttribute("checked");
            }
        });

        target.setAttribute("checked", "");
    }
}
