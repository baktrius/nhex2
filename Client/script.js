'use strict'
const canvasWrapperEl = document.getElementById('canvasWrapper');
const canvasEl = document.getElementById('canvas');
const futureCanvasEl = document.getElementById('futureCanvas');
const colorEL = document.getElementById('color');
const sizeEl = document.getElementById('size');
const viewXEl = document.getElementById('viewX');
const viewYEl = document.getElementById('viewY');
const zoomEl = document.getElementById('zoom');
const statusEl = document.getElementById('status');
const urlParams = new URLSearchParams(window.location.search);
const tableId = urlParams.get('id');

async function postData(url = '', data = {}) {
    // Default options are marked with *
    const response = await fetch(url, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/json'
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify(data) // body data type must match "Content-Type" header
    });
    return response.json(); // parses JSON response into native JavaScript objects
}
const token = urlParams.get('token');

function parseHash() {
    try {
        if (window.location.hash != '') {
            const [x, y, zoom] = window.location.hash.substring(1).split(',');
            viewXEl.value = x;
            viewYEl.value = y;
            zoomEl.value = zoom;
        }
    } catch (err) {
        console.log('unable to parse hash', err.message);
    }
}

parseHash();

function setStatus(message) {
    statusEl.innerText = message;
}

class Canvas {
    constructor(ctx, zoom, centerX, centerY) {
        this.ctx = ctx;
        this.commands = [];
        this.zoom = parseFloat(zoom);
        this.centerX = parseFloat(centerX);
        this.centerY = parseFloat(centerY);
        this.commandTag = 0;
    }
    toCanvasPos({x, y}) {
        return {
            x: (x - this.width / 2) / this.zoom + this.centerX,
            y: (y - this.height / 2) / this.zoom + this.centerY,
        }
    }
    fromCanvasPos({x, y}) {
        return {
            x: (x - this.centerX) * this.zoom + this.width / 2,
            y: (y - this.centerY) * this.zoom + this.height / 2,
        }

    }
    setZoom(zoom) {
        this.zoom = parseFloat(zoom);
        this.clear();
        this.redraw()
    }
    setCenter(x, y) {
        this.centerX = parseFloat(x ?? this.centerX);
        this.centerY = parseFloat(y ?? this.centerY);
        this.clear();
        this.redraw();
    }
    addCommand(command) {
        this.backend?.send(JSON.stringify([command]));
        this.commands.push(command);
        if (this.commands.length === 1) {
            this.onNonEmptyCallback?.();
        }
    }
    drawLine(x1, y1, x2, y2, color, size, addCommand = true) {
        const {x:realX1, y:realY1} = this.fromCanvasPos({x: x1, y: y1});
        const {x:realX2, y:realY2} = this.fromCanvasPos({x: x2, y: y2});
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = size * this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(realX1, realY1);
        this.ctx.lineTo(realX2, realY2);
        this.ctx.stroke();
        this.ctx.closePath();
        if (addCommand) {
            const command = {drawLine: {
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                color: color,
                size: size,
            }, tag: this.commandTag++};
            this.addCommand(command);
        }
    }
    drawCircle(x, y, color, size, addCommand = true) {
        const {x:realX, y:realY} = this.fromCanvasPos({x: x, y: y});
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(realX, realY, size * this.zoom / 2, 0, 2 * Math.PI, false);
        this.ctx.fill();
        this.ctx.closePath();
        if (addCommand) {
            const command = {drawCircle: {
                x: x,
                y: y,
                color: color,
                size: size,
            }, tag: this.commandTag++};
            this.addCommand(command);
        }
    }
    doCommands(commands, addCommand = true) {
        for (const command of commands) {
            this.doCommand(command, addCommand);
        }
    }
    doCommand(command, addCommand = true) {
        if (command.drawLine !== undefined) {
            const {x1, y1, x2, y2, color, size} = command.drawLine;
            this.drawLine(x1, y1, x2, y2, color, size, addCommand);
        }
        if (command.drawCircle !== undefined) {
            const {x, y, x2, y2, color, size} = command.drawCircle;
            this.drawCircle(x, y, color, size, addCommand);
        }
    }
    removeCommands(commands) {
        for (const command of commands) {
            const id = command.tag;
            if (id !== undefined) {
                const index = this.commands.findIndex((val) => val.tag === id);
                if (index >= 0) {
                    this.commands.splice(index, 1);
                    if (this.commands.length === 0) {
                        this.onEmptyCallback?.();
                    }
                }
            }
        }
    }
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }
    redraw() {
        this.doCommands(this.commands, false);
    }
    resize(width, height) {
        this.width = this.ctx.canvas.width = width;
        this.height = this.ctx.canvas.height = height;
        this.redraw();
    }
    bindBackend(backend, onEmptyCallback, onNonEmptyCallback) {
        this.onEmptyCallback = onEmptyCallback;
        this.onNonEmptyCallback = onNonEmptyCallback;
        this.backend = backend;
        if (this.commands.length > 0) {
            backend?.send(JSON.stringify(this.commands));
            this.onNonEmptyCallback?.();
        } else {
            this.onEmptyCallback?.();
        }
    }
}

const canvas = new Canvas(canvasEl.getContext('2d'), zoomEl.value, viewXEl.value, viewYEl.value);
const futureCanvas = new Canvas(futureCanvasEl.getContext('2d'), zoomEl.value, viewXEl.value, viewYEl.value);

function updateCanvas() {
    canvas.resize(canvasWrapperEl.clientWidth, canvasWrapperEl.clientHeight);
    futureCanvas.resize(canvasWrapperEl.clientWidth, canvasWrapperEl.clientHeight);
}

function updateHash() {
    window.location.hash = `#${viewXEl.value},${viewYEl.value},${zoomEl.value}`;
}

window.addEventListener('resize', updateCanvas);
viewXEl.addEventListener('input', () => {
    updateHash();
})
viewYEl.addEventListener('input', () => {
    updateHash();
})
zoomEl.addEventListener('input', () => {
    updateHash();
})

window.addEventListener('keydown', (event) => {
    const action = {
        ArrowLeft: () => viewXEl.value = parseInt(viewXEl.value) - 10,
        ArrowRight: () => viewXEl.value = parseInt(viewXEl.value) + 10,
        ArrowUp: () => viewYEl.value = parseInt(viewYEl.value) - 10,
        ArrowDown: () => viewYEl.value = parseInt(viewYEl.value) + 10,
        '-': () => zoomEl.value = max(parseFloat(zoomEl.value) - 0.1, 0.01),
        '=': () => zoomEl.value = parseFloat(zoomEl.value) + 0.1,
    }[event.key];
    if (action !== undefined) {
        action();
        updateHash();
    }
})

window.addEventListener('hashchange', () => {
    console.log('hash change');
    parseHash();
    canvas.setCenter(viewXEl.value, viewYEl.value);
    futureCanvas.setCenter(viewXEl.value, viewYEl.value);
    canvas.setZoom(zoomEl.value);
    futureCanvas.setZoom(zoomEl.value);
});

// pobranie początkowego koloru i wielkości
updateCanvas();

function getEventPos(event) {
    return {
        x: event.layerX,
        y: event.layerY,
    }
}

futureCanvasEl.addEventListener('mousedown', (event) => {
    let {x: posX, y: posY} = futureCanvas.toCanvasPos(getEventPos(event));
    futureCanvas.drawCircle(posX, posY, colorEL.value, sizeEl.value);
    function drawHandler (event) {
        const {x: newPosX, y: newPosY} = futureCanvas.toCanvasPos(getEventPos(event));
        futureCanvas.drawLine(posX, posY, newPosX, newPosY, colorEL.value, sizeEl.value);
        futureCanvas.drawCircle(newPosX, newPosY, colorEL.value, sizeEl.value);
        posX = newPosX;
        posY = newPosY;
    }
    function clearHandler(event) {
        const {x: newPosX, y: newPosY} = futureCanvas.toCanvasPos(getEventPos(event));
        futureCanvas.drawLine(posX, posY, newPosX, newPosY, colorEL.value, sizeEl.value);
        futureCanvas.drawCircle(newPosX, newPosY, colorEL.value, sizeEl.value);
        futureCanvasEl.removeEventListener('mousemove', drawHandler);
        document.body.removeEventListener('mouseup', clearHandler);
    }
    futureCanvasEl.addEventListener('mousemove', drawHandler);
    document.body.addEventListener('mouseup', clearHandler);
});

let redrawService = false;

async function run() {
    setStatus('obtaining address...');
    const response = await postData(`board/${tableId}/join`);
    console.log(response);
    const wsBackend = response.link;
    console.log('connecting...');
    console.log(wsBackend + (token ? `?token=${token}` : ''));
    const ws = new WebSocket(wsBackend + (token ? `?token=${token}` : ''));
    ws.onopen = () => {
        setStatus('loading data...');
    };
    ws.onmessage = (mes) => {
        try {
            const data = JSON.parse(mes.data);
            if (data?.success === true) {
                if (data.data !== undefined) {
                    const commands = data?.data?.commands;
                    if (commands !== undefined && typeof commands === 'object') {
                        canvas.doCommands(commands);
                    }
                    futureCanvas.bindBackend(ws, () => {
                        setStatus('synchronized');
                    }, () => {
                        setStatus('synchronizing...');
                    });
                }
                if (data.message !== undefined) {
                    const commands = JSON.parse(data.message);
                    if (commands !== undefined && typeof commands === 'object') {
                        canvas.doCommands(commands);
                        futureCanvas.removeCommands(commands);
                        if (redrawService === false) {
                            redrawService = setTimeout(() => {
                                futureCanvas.clear();
                                futureCanvas.redraw();
                            }, 50);
                        }
                    }
                }
            } else if (data?.success === false) {
                console.error(data?.reason);
                alert(data?.reason);
            }
            if (data?.exec !== undefined) {
                canvas.doCommands(data?.exec);
            }
        } catch(err) {
            console.log(err);
        }
    }
    ws.onclose = () => {
        setStatus('connection lost');
    }
}

run().catch(console.error);