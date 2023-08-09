const mineflayer = require('mineflayer') // 讀取mineflayer模塊
const tokens = require('prismarine-tokens-fixed') // 讀取微軟驗證緩存模塊
const config = require(`${process.cwd()}/config.json`) // 獲得config.json資料
const LoginOption = {
  host: config.ip, // 伺服器IP
  username: config.username, // 任意英文數字
  password: config.password, // 任意英文數字
  port: config.port, // 預設25565
  version: false, 
  auth: 'microsoft',
  tokensLocation: './bot_tokens.json',
  tokensDebug: true
};



tokens.use(LoginOption, function(_err, _opts){ // 驗證緩存 BOT登入伺服器
  if (_err) throw _err
  const bot = mineflayer.createBot(_opts)
  bot.on('login', (username, message) => {
    console.log(">>>>>>>>>>>>>>>>>>>> Bot is Online <<<<<<<<<<<<<<<<<<<<")
  })
  console.log('Commands :\n' +
  '  show villagers\n' +
  '  show inventory\n' +
  '  show trades <id>\n' +
  '  trade <id> <trade> [<times>]')


bot.on('chat', (username, message) => {
  if (username === bot.username) return
  const command = message.split(' ')
  switch (true) {
    case message === 'show villagers':
      showVillagers()
      break
    case message === 'show inventory':
      showInventory()
      break
    case /^show trades [0-9]+$/.test(message):
      showTrades(command[2])
      break
    case /^trade [0-9]+ [0-9]+( [0-9]+)?$/.test(message):
      trade(command[1], command[2], command[3])
      break
  }
})

function showVillagers () {
  const villagers = Object.keys(bot.entities).map(id => bot.entities[id]).filter(e => e.entityType === bot.registry.entitiesByName.villager.id)
  const closeVillagersId = villagers.filter(e => bot.entity.position.distanceTo(e.position) < 3).map(e => e.id)
  bot.chat(`found ${villagers.length} villagers`)
  bot.chat(`villager(s) you can trade with: ${closeVillagersId.join(', ')}`)
}

function showInventory () {
  bot.inventory.slots
    .filter(item => item).forEach((item) => {
      bot.chat(stringifyItem(item))
    })
}

async function showTrades (id) {
  const e = bot.entities[id]
  switch (true) {
    case !e:
      bot.chat(`cant find entity with id ${id}`)
      break
    case e.entityType !== bot.registry.entitiesByName.villager.id:
      bot.chat('entity is not a villager')
      break
    case bot.entity.position.distanceTo(e.position) > 3:
      bot.chat('villager out of reach')
      break
    default: {
      const villager = await bot.openVillager(e)
      villager.close()
      stringifyTrades(villager.trades).forEach((trade, i) => {
        bot.chat(`${i + 1}: ${trade}`)
      })
    }
  }
}

async function trade (id, index, count) {
  const e = bot.entities[id]
  switch (true) {
    case !e:
      bot.chat(`cant find entity with id ${id}`)
      break
    case e.entityType !== bot.registry.entitiesByName.villager.id:
      bot.chat('entity is not a villager')
      break
    case bot.entity.position.distanceTo(e.position) > 3:
      bot.chat('villager out of reach')
      break
    default: {
      const villager = await bot.openVillager(e)
      const trade = villager.trades[index - 1]
      count = count || trade.maximumNbTradeUses - trade.nbTradeUses
      switch (true) {
        case !trade:
          villager.close()
          bot.chat('trade not found')
          break
        case trade.disabled:
          villager.close()
          bot.chat('trade is disabled')
          break
        case trade.maximumNbTradeUses - trade.nbTradeUses < count:
          villager.close()
          bot.chat('cant trade that often')
          break
        case !hasResources(villager.slots, trade, count):
          villager.close()
          bot.chat('dont have the resources to do that trade')
          break
        default:
          bot.chat('starting to trade')
          try {
            await bot.trade(villager, index - 1, count)
            bot.chat(`traded ${count} times`)
          } catch (err) {
            bot.chat('an error occurred while trying to trade')
            console.log(err)
          }
          villager.close()
      }
    }
  }

  function hasResources (window, trade, count) {
    const first = enough(trade.inputItem1, count)
    const second = !trade.inputItem2 || enough(trade.inputItem2, count)
    return first && second

    function enough (item, count) {
      let c = 0
      window.forEach((element) => {
        if (element && element.type === item.type && element.metadata === item.metadata) {
          c += element.count
        }
      })
      return c >= item.count * count
    }
  }
}

function stringifyTrades (trades) {
  return trades.map((trade) => {
    let text = stringifyItem(trade.inputItem1)
    if (trade.inputItem2) text += ` & ${stringifyItem(trade.inputItem2)}`
    if (trade.disabled) text += ' x '; else text += ' » '
    text += stringifyItem(trade.outputItem)
    return `(${trade.nbTradeUses}/${trade.maximumNbTradeUses}) ${text}`
  })
}

function stringifyItem (item) {
  if (!item) return 'nothing'
  let text = `${item.count} ${item.displayName}`
  if (item.nbt && item.nbt.value) {
    const ench = item.nbt.value.ench
    const StoredEnchantments = item.nbt.value.StoredEnchantments
    const Potion = item.nbt.value.Potion
    const display = item.nbt.value.display

    if (Potion) text += ` of ${Potion.value.replace(/_/g, ' ').split(':')[1] || 'unknown type'}`
    if (display) text += ` named ${display.value.Name.value}`
    if (ench || StoredEnchantments) {
      text += ` enchanted with ${(ench || StoredEnchantments).value.value.map((e) => {
        const lvl = e.lvl.value
        const id = e.id.value
        return bot.registry.enchantments[id].displayName + ' ' + lvl
      }).join(' ')}`
    }
  }
  return text
}
