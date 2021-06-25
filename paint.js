(() => {
  const {fromEvent, interval} = rxjs;
  const {filter, mapTo, merge, startWith, distinctUntilChanged, map, switchMap, withLatestFrom, bufferCount, takeWhile} = rxjs.operators;

  class BlobCanvas {
    constructor($canvas) {
      this.$cvs = $canvas;
      this.ctx = $canvas.getContext('2d');
      this.ctx.lineCap = 'round';
      this.ctx.strokeStyle = 'black';
      this.img = this.ctx.getImageData(...this.getCanvasRect());
      this.cursorType = 'pen';
      this.cursorPosition = {
        x: null,
        y: null,
      }
      this.buffer = [];
      this.currentColor = 'black';
      this.tick = 0;
    }

    getCanvasRect() {
      return [0, 0, this.$cvs.width, this.$cvs.height];
    }

    draw(from, to, color, width) {
      this.buffer.push({
        type: 'draw',
        args: [from, to, color, width]
      });
    }

    erase(from, to, width = 50) {
      this.buffer.push({
        type: 'draw',
        args: [from, to, '#FFF', width]
      });
    }

    clear() {
      this.buffer.push({
        type: 'clear',
        args: []
      });
    }

    cursorMoveTo(x, y) {
      this.cursorPosition.x = x;
      this.cursorPosition.y = y;
    }

    setCursorType(type) {
      this.cursorType = type;
    }

    getImageData() {
      return this.ctx.getImageData(...this.getCanvasRect());
    }

    setColor(color) {
      this.currentColor = color;
    }

    render() { 
      this.ctx.putImageData(this.img, 0, 0);
      let idx = -1;
      if (++this.tick % 3 === 0) {
        this.ctx.beginPath();
        const len = this.buffer.length;
        while (++idx < len) {
          const task = this.buffer[idx];
          if (task.type === 'draw') {
            const [from, to, color, width] = task.args;
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = width;
            this.ctx.moveTo(from.x, from.y);
            this.ctx.lineTo(to.x, to.y);
            if (idx === len - 1 || this.buffer[idx + 1].type !== 'draw') {
              this.ctx.stroke();
            }
          } else if (task.type === 'clear') {
            if (idx === len - 1 || this.buffer[idx + 1].type !== 'clear') {
              this.ctx.clearRect(...this.getCanvasRect());
            }
          }
        }
        this.buffer = [];
      }

      this.img = this.getImageData();

      if (this.cursorPosition.x === null) return;
      this.ctx.beginPath();
      const {x, y} = this.cursorPosition;
      const r = this.cursorType === 'pen' ? 5 : 25;
      if (this.cursorType === 'pen') {
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.fillStyle = this.currentColor;
        this.ctx.lineWidth = 5
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fill()
      } else {
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }

    toDataURL() {
      return this.$cvs.toDataURL();
    }
  }

  function toPositionByOffset({offsetX, offsetY}) {
    return {
      x: offsetX,
      y: offsetY,
    };
  }

  function initPaint() {
    let stColor = 'black';
    let stWidth = 5;
    const $cvs = document.querySelector('#canvas2');
    const canvas = new BlobCanvas($cvs);
    fromEvent(window, 'keydown')
      .subscribe(console.log);

    const colorRect = (color) => {
      const div = document.createElement('div');
      Object.assign(div.style, {
        width: '50px',
        height: '50px',
        border: '1px solid black',
        backgroundColor: color,
      });
      div.classList.add('col');
      return div;
    };

    const colorSet = ['black', 'red', 'white', 'green'];

    colorSet.forEach((color) => {
      const $el = colorRect(color);
      document.querySelector('.color-bar').appendChild($el);
      fromEvent($el, 'click').subscribe(() => {
        stColor = color;
        (document.querySelector('.current-color')).style.backgroundColor = color;
        canvas.setColor(color);
      })
    })

    const mouseDown$ = fromEvent($cvs, 'mousedown');
    const mouseUp$ = fromEvent($cvs, 'mouseup');
    const mouseMove$ = fromEvent($cvs, 'mousemove');
    const mouseOut$ = fromEvent($cvs, 'mouseleave');

    mouseOut$.subscribe(console.log);

    const isAlt = (e) => e.keyCode === 18;
    const altKeyDown$ = fromEvent(window, 'keydown').pipe(filter(isAlt));
    const altKeyUp$ = fromEvent(window, 'keyup').pipe(filter(isAlt));

    const altPressing$ = altKeyDown$
      .pipe(
        mapTo(true),
        merge(altKeyUp$.pipe(mapTo(false))),
        startWith(false),
        distinctUntilChanged(),
      );

    const done$ = mouseUp$.pipe(merge(mouseOut$), map(toPositionByOffset));

    mouseMove$
      .pipe(
        merge(mouseOut$),
        map(toPositionByOffset)
      )
      .subscribe(({x, y}) => {
        canvas.cursorMoveTo(x, y);  
      });
    
    const draw$ = mouseDown$
      .pipe(
        switchMap((e) => {
          return mouseMove$
            .pipe(
              startWith(e),
              map(toPositionByOffset),
              merge(done$.pipe(map(a => Object.assign({}, a, { done: true })))),
              bufferCount(2, 1),
              takeWhile(([a, _]) => !a.done),
            );
        }),
        withLatestFrom(altPressing$),
      );

    const clear$ = fromEvent(document.querySelector('.clear-button'), 'click');

    altPressing$
        .subscribe((eraser) => {
          if (eraser) {
            canvas.setCursorType('eraser');
          } else {
            canvas.setCursorType('pen');
          }
        });

    draw$.subscribe(([[e1, e2], isErase]) => {
      if (!isErase) {
        canvas.draw(e1, e2, stColor, stWidth);
      } else {
        canvas.erase(e1, e2);
      }
    });

    clear$.subscribe(() => {
      canvas.clear();
    });

    interval(1000 / 60).subscribe(() => canvas.render());

    return canvas;
  }

  window.BlobCanvas = BlobCanvas;
  window.initPaint = initPaint;
})();
