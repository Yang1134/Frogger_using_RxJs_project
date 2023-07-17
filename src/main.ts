import "./style.css";
import { interval, fromEvent, Subscription } from "rxjs";
import { map, filter, scan, mergeMap, refCount, takeUntil, merge} from "rxjs/operators";


function main() {

  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */

  /**
   * This is the view for your game to add and update your game elements.
   */
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;
  
  
  const
    Constants = {
      CanvasSize: Number(svg.getAttribute('width')),
      FX: 300, 
      FY: 565,
      FHeight: 20,
      FWidth: 20,
      objectHeight: 55,
      StartCars1Count: 2,
      StartCars2Count: 1,
      StartCars3Count:3,
      StartLog1Count: 1,
      StartLog2Count: 3,
      StartLog3Count: 2,
      StartExitCount: 5,
      CarPos1: [30, 120],
      CarPos2: [400],
      CarPos3: [50, 300, 380],
      LogPos1: [70],
      LogPos2: [50, 170, 500],
      LogPos3: [200, 480],
      ExitPos: [142, 275, 408, 10, 538],
      StartTime: 0,
      Speed: [2, -1, 3, 0.5, -1.5, -2.2], //it was too many constant variable declared at this point
      Score: 100
    } as const

  // our game has the following view element types: View types are declared more distinctively for better clarification
  type ViewType = 'frog' | 'car1' | 'car2' | 'car3' | 'log1' | 'log2'| 'log3' | 'exit'

  /**
 * wraps the objects position and movement so that it comes  back from its opposite side.
 * @param x the x coordinates
 * @param y the y coordinates
 * 
 * {x, y} is the format of the Vec class
 */         
  const 
    torusWrap = ({x,y}:Vec) => { 
      const 
        s = Constants.CanvasSize,
        wrap = (v:number) => 
        v < 0 ? v + s : v > s ? v - s : v;
      return new Vec(wrap(x),wrap(y))
    };

  type Event = 'keydown' | 'keyup'
  type Key = 'KeyA' | 'KeyD' | 'KeyW' | 'KeyS'

  class Tick { 
    constructor(public readonly elapsed: number) {}
  }
  //class to determine movement from side to side
  class MoveSide {
    constructor(public readonly x:number) {} 
  }
  //class to determine movement vertically
  class MoveVert { 
    constructor(public readonly y:number) {} }


 // reconstructed States and Body-------------------------------
  // declared type that accepts position and width of an object body
  type Rectangle = Readonly<{pos:Vec, width:number}> 
  // declared type that accepts an id and number of times created (irrelevant)
  type ObjectId = Readonly<{id:string,createTime:number}>
  //an interface for all objects that interacts with frog and is frog
  interface IBody extends Rectangle, ObjectId{ 
    vel: Vec, 
    acc: Vec, 
    height: number, 
    viewType: ViewType,
  }

  type Body = Readonly<IBody> 

  //state determines the change of state of different objects and game
  type State = Readonly<{
    time:number,
    frog:Body,
    cars1:ReadonlyArray<Body>,
    cars2:ReadonlyArray<Body>,
    cars3:ReadonlyArray<Body>,
    objCount:number,
    logs1:ReadonlyArray<Body>,
    logs2:ReadonlyArray<Body>,
    logs3:ReadonlyArray<Body>,
    gameOver:boolean,
    exits: ReadonlyArray<Body>,
    score: number,
    multiplier: number,
    frogLife: number
  }>

  /**
 * function to create all rectangular objects
 * @param viewType determines the view for html purposes
 * @param oid takes position and width of an object
 * @param rect takes id and "create times"
 * @param oid takes the velocity of the object
 * 
 */     
  const createRect = (viewType: ViewType)=> (oid:ObjectId)=> (rect:Rectangle)=> (nVel:Vec)=> 
    <Body>{
      ...oid,
      ...rect,
      vel:nVel,
      acc: Vec.Zero,
      height: Constants.objectHeight,
      viewType: viewType,
      id: viewType + oid.id,
    },
    // creation of different rows of object distinctively
    createCar1 = createRect('car1'),
    createCar2 = createRect('car2'),
    createCar3 = createRect('car3'),
    createLog1 = createRect('log1'),
    createLog2 = createRect('log2'),
    createLog3 = createRect('log3'),
    createExit = createRect('exit')
    

  //-------------------------------------------------------------------
 
  //create frog with default values
  const createFrog = () =>
  <Body>{
      id: 'frog',
      viewType: 'frog',
      pos: new Vec(Constants.FX, Constants.FY), 
      vel: Vec.Zero,
      acc: Vec.Zero,
      width: Constants.FWidth,
      height: Constants.FHeight,
      createTime: 0
  }

  //initial state section, determines the state when the game begins
  const 
    //this section creates all interactive objects (cars, logs, exits)
    startCars1 = [...Array(2)]
      .map((_,i) => createCar1({id: String(i), createTime: Constants.StartTime})
      ({pos: new Vec(Constants.CarPos1[i], 470), width: 70})
      (new Vec(Constants.Speed[0], 0))),

    startCars2 = [...Array(Constants.StartCars2Count)]
      .map((_,i) => createCar2({id: String(i), createTime: Constants.StartTime})
      ({pos: new Vec(Constants.CarPos2[i], 405), width: 120})
      (new Vec(Constants.Speed[1], 0))), //Math.random()*(600-0+1)+0

    startCars3 = [...Array(Constants.StartCars3Count)]
      .map((_,i) => createCar3({id: String(i), createTime: Constants.StartTime})
      ({pos: new Vec(Constants.CarPos3[i], 338), width: 50})
      (new Vec(Constants.Speed[2], 0))),

    startLogs1 = [...Array(Constants.StartLog1Count)]
      .map((_,i) => createLog1({id: String(i), createTime: Constants.StartTime})
      ({pos: new Vec(Constants.LogPos1[i], 207), width: 200})
      (new Vec(Constants.Speed[3], 0))),

    startLogs2 = [...Array(Constants.StartLog2Count)]
      .map((_,i) => createLog2({id: String(i), createTime: Constants.StartTime})
      ({pos: new Vec(Constants.LogPos2[i], 142), width: 90})
      (new Vec(Constants.Speed[4], 0))),

    startLogs3 = [...Array(Constants.StartLog3Count)]
      .map((_,i) => createLog3({id: String(i), createTime: Constants.StartTime})
      ({pos: new Vec(Constants.LogPos3[i], 76), width: 100})
      (new Vec(Constants.Speed[5], 0))),
      
    startExit= [...Array(Constants.StartExitCount)]
      .map((_,i) => createExit({id: String(i), createTime: Constants.StartTime})
      ({pos: new Vec(Constants.ExitPos[i], 10), width: 55})
      (Vec.Zero)),

    // setting for initial state
    initialState:State = {
      time:0,
      frog: createFrog(),
      //creates the objects based on above
      cars1: startCars1,
      cars2: startCars2,
      cars3: startCars3,
      logs1: startLogs1,
      logs2: startLogs2,
      logs3: startLogs3,
      objCount: Constants.StartCars1Count + Constants.StartCars2Count + Constants.StartCars3Count + 
                Constants.StartLog1Count + Constants.StartLog2Count + Constants.StartLog3Count 
                + Constants.StartExitCount,
      gameOver: false,
      exits: startExit,
      score: 0, //accumulator for score
      multiplier: 1, //accumulator for multiplier
      frogLife: 3
    }
  //-------------------------------------------------------------------------------

  const
    //this section extracts keyboard events to determine frog's movement
      observeKey = <T>(eventName:Event, k:Key, result:()=>T)=>
      fromEvent<KeyboardEvent>(document,eventName)
        .pipe(
          filter(({code})=>code === k),
          filter(({repeat})=>!repeat),
          map(result)),
      // 4 different actions, 
      // move horizontally with the distance of 33
      //moving vertically with the distance of 66
      startLeft = observeKey('keydown','KeyA',()=>new MoveSide(-33)),
      startRight = observeKey('keydown', 'KeyD', () => new MoveSide(33)),
      startUp = observeKey('keydown', 'KeyW', () => new MoveVert(-66)),
      startDown = observeKey('keydown', 'KeyS', () => new MoveVert(66))


 /**
 * function to determine the states and actions taken, then returning an updated state
 * 
 * @param s state of the game
 * @param e set of actions or to tick over all objects
 * 
 * 
 */    
  const reduceState = (s:State, e: MoveSide|MoveVert|Tick)=>
    e instanceof MoveSide ? { ...s,
      frog: {...s.frog, pos: s.frog.pos.moveX(e.x)}
    }:
    e instanceof MoveVert ? { ...s,
      frog: {...s.frog, pos: s.frog.pos.moveY(e.y)}
    }: 
      tick(s,e.elapsed)


  // all movement comes through here
  const moveObj = (o:Body) => <Body>{
    ...o,
    pos:torusWrap(o.pos.add(o.vel)),
    vel:o.vel
  }


  // this section handles all interactions between frog and all objects
  const handleCollisions = (s:State) => {
    const
      /**
     * this section checks for the different positions frog could be on using logics first
     * levelCheck: checks for the level of frog, specifically y-axis. frog's cy has to be within objects' bounds
     * frogLCheck: checks for contact using the left side of frog (for car)
     * frogRCheck: checks for contact using the left side of frog (for car)
     * frogRCheck: checks for contact using the centre of the frog (for log & exit)
     * riverCheck: checks if frog is out of log
     */    
      levelCheck = ([a,b]:[Body,Body]) => (a.pos.y - a.width) > b.pos.y && (a.pos.y - a.width) < (b.pos.y + b.height),
      frogLCheck = ([a,b]:[Body,Body]) => (a.pos.x - a.width) > b.pos.x && (a.pos.x - a.width) < (b.pos.x + b.width),
      frogRCheck = ([a,b]:[Body,Body]) => (a.pos.x + a.width) > b.pos.x && (a.pos.x + a.width) < (b.pos.x + b.width),
      frogCCheck = ([a,b]:[Body,Body]) => a.pos.x > b.pos.x && a.pos.x < (b.pos.x + b.width),
      riverCheck = ([a,b]:[Body,Body]) => (a.pos.x <= b.pos.x || a.pos.x >= (b.pos.x + b.width)) && levelCheck([a,b]),

      //bodiesCollided: the logic for checking if frog hits car
      bodiesCollided = ([a,b]:[Body,Body]) => levelCheck([a,b]) && (frogLCheck([a,b]) || frogRCheck([a,b])),
      // inLog: logic for when frog is within log (frog's body has to be more than half)
      inLog = ([a,b]:[Body,Body]) => levelCheck([a,b]) && frogCCheck([a,b]),

      // applying bodiesCollided on all cars
      // it uses length to check to see if, when filtered that the conditions are true,
      // it should be > 0
      carsCollided = (s.cars1.filter(r=>bodiesCollided([s.frog,r])).length > 0) 
      || s.cars2.filter(r=>bodiesCollided([s.frog,r])).length > 0 
      || s.cars3.filter(r=>bodiesCollided([s.frog,r])).length > 0,

      // to check if frog is on any of the logs, to avoid river being the main check
      logsLanded1 = s.logs1.filter(r=>inLog([s.frog,r])).length > 0,
      logsLanded2 = s.logs2.filter(r=>inLog([s.frog,r])).length > 0,
      logsLanded3 = s.logs3.filter(r=>inLog([s.frog,r])).length > 0,

      // to check if frog is in river
      riverCollided = (s.logs1.filter(r=>riverCheck([s.frog,r])).length > 0) 
      || s.logs2.filter(r=>riverCheck([s.frog,r])).length > 0 
      || s.logs3.filter(r=>riverCheck([s.frog,r])).length > 0,

      // checks if frog is in the exit box
      exitIn = s.exits.filter(r=>inLog([s.frog,r])).length > 0,
      // gets the remaining exits for the next round (to avoid repeated exits)
      exitsLeft = s.exits.filter(r=>!(inLog([s.frog,r]))),
      // game ends when all exits have been cleared
      gameWin = s.exits.length === 0,

      // end game condition
      endGame = (carsCollided || riverCollided || gameWin) && 
      !(logsLanded1) && !(logsLanded2) && !(logsLanded3),
      // conditions that shows frog failed at something
      backToStart = (carsCollided || riverCollided) && 
      !(logsLanded1) && !(logsLanded2) && !(logsLanded3)



    return <State>{
      ...s,
      frog: {...s.frog, 
        // to determine frogs direction when on log, to show it is with the log
        vel: (logsLanded1 ? new Vec(Constants.Speed[3], 0) : 
        logsLanded2 ? new Vec(Constants.Speed[4], 0) : 
        logsLanded3 ? new Vec(Constants.Speed[5], 0) : Vec.Zero), 
        // to reset frog position when enter exit or failed an obstacle
        pos: exitIn || backToStart ? new Vec(Constants.FX, Constants.FY) : s.frog.pos},
      // gameover happens only when life = 0
      gameOver: s.frogLife ? false : endGame,
      // to return available exit boxes
      exits: exitsLeft,
      // to increase multiplier for score system
      multiplier: exitIn ? s.multiplier + 1 : s.multiplier,
      // to increment score when frog reaches a box
      score: exitIn ? s.score + (Constants.Score * s.multiplier) : s.score,
      // to decrease frog's lifecount when something bad happened
      frogLife: endGame ? s.frogLife - 1 : s.frogLife
    }
  }

  // tick returns the new state of all objects, ensuring all objects move
  const tick = (s:State,elapsed:number) => {
    return handleCollisions({...s, 
      frog:moveObj(s.frog), 
      cars1:s.cars1.map(moveObj),
      cars2:s.cars2.map(moveObj),
      cars3:s.cars3.map(moveObj),
      logs1:s.logs1.map(moveObj),
      logs2:s.logs2.map(moveObj),
      logs3:s.logs3.map(moveObj),
      time:elapsed
    })
  }

  // this is where the game runs
  const subscription = interval(10).pipe(
    map(elapsed=>new Tick(elapsed)),
    merge(startLeft, startRight, startUp, startDown),
    scan(reduceState, initialState))
    .subscribe(updateView);

  /**
   * attr is a function that makes attribute setting or editing on objetcs/elements easy
   * 
   * @param e the affected element/object
   * @param o a fix format to set the properties
   * 
   */  
  const
    attr = (e:Element, o:{ [key:string]: Object }) =>
      { for(const k in o) e.setAttribute(k,String(o[k])) }

  // the only impure function
  // this is where the objects are truly created in view or updated in view
  function updateView(s:State): void {
    const frog = document.getElementById("frog")!

    // a quick function to create and view objects on the canvas/svg
    const updateBodyView = (b:Body) => {
      function createBodyView() {
        const v = document.createElementNS(svg.namespaceURI, "rect")!;
        attr(v, {id:b.id, width:b.width, height:b.height});
        v.classList.add(b.viewType)
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createBodyView();
      attr(v, {x:b.pos.x, y:b.pos.y});
    };

    // to update frog's position using initial state from time to time
    attr(frog, {transform: `translate(${s.frog.pos.x},${s.frog.pos.y})`})
    //create all necessary objects
    s.cars1.forEach(updateBodyView);
    s.cars2.forEach(updateBodyView);
    s.cars3.forEach(updateBodyView);
    s.logs1.forEach(updateBodyView);
    s.logs2.forEach(updateBodyView);
    s.logs3.forEach(updateBodyView);
    s.exits.forEach(updateBodyView);
  

    // a text element to view game over status and score
    const v = document.createElementNS(svg.namespaceURI, "text")!;
      attr(v,{
        x: Constants.CanvasSize/6,
        y: Constants.CanvasSize/2,
        class: "gameover"
      });
    
    // if gameover is true, the game stops (by unsubscribing), then shows the score and gameover status
    if(s.gameOver) {
      v.textContent = "Game Over. Score: " + s.score;
      svg.appendChild(v);
      subscription.unsubscribe()
    }
  }
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}

/**
 * A simple immutable vec that manipulates positions
 */
class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
  sub = (b:Vec) => this.add(b.scale(-1))
  len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
  scale = (s:number) => new Vec(this.x*s,this.y*s)


  moveX = (nx:number) => new Vec(this.x + nx, this.y)
  moveY = (ny:number) => new Vec(this.x, this.y + ny)

  static Zero = new Vec();
}



