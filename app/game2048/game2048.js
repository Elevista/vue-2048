import tile from './tile.vue'
import Hammer from 'hammerjs'

export default {
  name: 'game2048',
  data () {
    return {
      game: {size: [4, 4], tileSize: 100, maxStack: 5},
      state: null,
      tiles: null,
      tileMap: null,
      stack: null,
      lock: null
    }
  },
  created () {
    this.reset()
    window.localStorage.stack ? this.restore() : this.restart()
  },
  mounted () {
    document.addEventListener('keydown', this.onKeyDown)
    let {DIRECTION_LEFT: left, DIRECTION_RIGHT: right, DIRECTION_UP: up, DIRECTION_DOWN: down, DIRECTION_ALL: all} = Hammer
    let directions = {[left]: '←', [up]: '↑', [down]: '↓', [right]: '→'}
    let hm = new Hammer(this.$refs.grid)
    hm.get('swipe').set({direction: all, threshold: 5})
    hm.on('swipe', ev => {
      let direction = directions[ev.direction]
      direction && this.move(direction)
    })
  },
  computed: {
    gameEnd () { return (this.state.win && !this.state.keepGoing) || this.state.gameover }
  },
  methods: {
    reset () {
      Object.assign(this, {
        tiles: [],
        tileMap: {},
        stack: [],
        lock: false,
        state: {
          win: false,
          gameover: false,
          score: 0,
          keepGoing: false,
          tileId: 1,
          bestScore: +window.localStorage.bestScore || 0
        }
      })
    },
    restart () {
      this.reset()
      this.generate()
    },
    keepGoing () { this.state.keepGoing = true },
    saveImmediate () {
      window.localStorage.stack = JSON.stringify(this.stack)
      window.localStorage.bestScore = this.state.bestScore
    },
    save: _.throttle(function () { this.saveImmediate() }, 2000, {trailing: false}),
    restore () {
      this.reset()
      let stack = JSON.parse(window.localStorage.stack || 'null')
      if (!stack) return
      let [state, tiles] = _.last(stack)
      this.tileMap = _.keyBy(tiles, ({x, y}) => this.key(x, y))
      this.stack = stack
      Object.assign(this, {tiles, state})
    },
    onKeyDown (evt) {
      let keyCode = {38: '↑', 40: '↓', 37: '←', 39: '→'}
      let direction = keyCode[evt.keyCode]
      if (!direction) return
      this.move(direction)
      evt.preventDefault()
    },
    remember () {
      if (!this.tiles.length) return
      this.stack.push([Object.assign({}, this.state), _.map(this.tileMap, x => x && Object.assign({}, x))])
      if (this.stack.length - 1 > this.game.maxStack) this.stack.shift()
      this.gameEnd ? this.saveImmediate() : this.save()
    },
    undo () {
      if (this.stack.length < 2) return
      this.stack.pop()
      let [state, tiles] = _.last(this.stack)
      let lastTiles = tiles.map(x => Object.assign({}, x))
      this.tileMap = _.keyBy(lastTiles, ({x, y}) => this.key(x, y))
      Object.assign(this, {state: Object.assign({}, state), tiles: lastTiles})
      this.save()
    },
    key (x, y) { return `${x}:${y}` },
    gameoverCheck () {
      let [width, height] = this.game.size
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          let tile = _.get(this.tileMap, [this.key(x, y), 'value'])
          let right = _.get(this.tileMap, [this.key(x + 1, y), 'value'])
          let down = _.get(this.tileMap, [this.key(x, y + 1), 'value'])
          if (tile === right || tile === down) return
        }
      }
      this.state.gameover = true
    },
    increaseScore (value, combo) {
      this.state.score += combo > 1 ? value * (Math.pow(combo, 1.4) / 2) : value
      if (this.state.score > this.state.bestScore) this.state.bestScore = this.state.score
    },
    generate () {
      let [width, height] = this.game.size
      for (let x of _(0).range(width).shuffle().value()) {
        for (let y of _(0).range(height).shuffle().value()) {
          let key = this.key(x, y)
          if (this.tileMap[key]) continue
          this.tiles.push(this.tileMap[key] = {id: this.state.tileId++, combo: 0, x, y, value: 2})
          if (this.tiles.length === width * height) this.gameoverCheck()
          this.remember()
          return
        }
      }
    },
    * moveUp (tileX, tileY) {
      for (let y = tileY - 1; y >= 0; y--) yield [tileX, y]
    },
    * moveDown (tileX, tileY) {
      for (let y = tileY + 1; y < this.game.size[1]; y++) yield [tileX, y]
    },
    * moveLeft (tileX, tileY) {
      for (let x = tileX - 1; x >= 0; x--) yield [x, tileY]
    },
    * moveRight (tileX, tileY) {
      for (let x = tileX + 1; x < this.game.size[0]; x++) yield [x, tileY]
    },
    move (direction) {
      if (this.gameEnd) return
      let directions = {
        '↑': [this.moveUp, ['x', 'y'], ['asc', 'asc']],
        '↓': [this.moveDown, ['x', 'y'], ['asc', 'desc']],
        '←': [this.moveLeft, ['y', 'x'], ['asc', 'asc']],
        '→': [this.moveRight, ['y', 'x'], ['asc', 'desc']]
      }
      let [iterator, ...orderBy] = directions[direction]

      let moved = false
      let [toRemove, combines, combined] = [[], [], {}]
      let combine = (to, tile) => {
        if (to.value !== tile.value) return
        combined[to.id] = combined[tile.id] = true
        to.value += tile.value
        let combo = Math.max(to.combo, tile.combo) + 1
        combines.push([to, combo])
        Object.assign(tile, {x: to.x, y: to.y})
        if (to.value === 2048) this.state.win = true
      }
      _(this.tiles).filter(({x, y}) => this.tileMap[this.key(x, y)]).orderBy(...orderBy).forEach(tile => {
        let movedKey = null
        let key = this.key(tile.x, tile.y)
        for (let [x, y] of iterator(tile.x, tile.y)) {
          let toKey = this.key(x, y)
          let to = this.tileMap[toKey]
          if (to) {
            if (!combined[to.id]) combine(to, tile)
            break
          } else {
            movedKey = toKey
            Object.assign(tile, {x, y})
          }
        }
        let tileMoved = combined[tile.id] || movedKey
        if (tileMoved) delete this.tileMap[key]
        if (combined[tile.id]) toRemove.push(tile)
        else if (movedKey) this.tileMap[movedKey] = tile
        moved = moved || tileMoved
      })
      if (moved) {
        this.tiles.forEach(x => { x.combo = 0 })
        combines.forEach(([tile, combo]) => {
          this.increaseScore(tile.value, combo)
          tile.combo = combo
        })
        this.$nextTick(() => {
          _.pullAll(this.tiles, toRemove)
          this.generate()
        })
      }
    }
  },
  detroyed () { document.removeEventListener('keydown', this.onKeyDown) },
  components: {tile},
  templateSrc: './game2048.html',
  styleSrc: './game2048.css'
}
