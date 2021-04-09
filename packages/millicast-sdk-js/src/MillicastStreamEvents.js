import MillicastLogger from './MillicastLogger'
import MillicastEventSubscriber from './utils/MillicastEventSubscriber'

const USER_COUNT_TARGET = 'SubscribeViewerCount'

const logger = MillicastLogger.get('MillicastStreamEvents')
const messageType = { REQUEST: 1, RESPONSE: 3 }
let invocationId = 0

/**
 * Callback invoke when new user count is received.
 *
 * @callback onUserCountCallback
 * @param {Object} data
 * @param {String} data.streamId - Stream identifier with the following format `accountId/streamName`.
 * @param {Number} data.count    - Current amount of viewers of the stream.
 * @param {String} [data.error]  - Error message.
 */

/**
 * @class MillicastStreamEvents
 * @classdesc Lets you to subscribe to stream events like receive the amount of viewers of a stream.
 *
 * This events are handled via a WebSocket with Millicast server.
 * @hideconstructor
 */
export default class MillicastStreamEvents {
  constructor () {
    this.millicastEventSubscriber = null
  }

  /**
   * Initializes the connection with Millicast Stream Event.
   * @returns {Promise<MillicastStreamEvents>} Promise object which represents the MillicastStreamEvents instance
   * once the connection with the Millicast stream events is done.
   * @example const streamEvents = await MillicastStreamEvents.init()
   */
  static async init () {
    const instance = new MillicastStreamEvents()
    instance.millicastEventSubscriber = new MillicastEventSubscriber()
    await instance.millicastEventSubscriber.initializeHandshake()

    return instance
  }

  /**
   * Subscribes to User Count event and invokes the callback once a new message is available.
   * @param {String} accountId - Millicast Account Id.
   * @param {String} streamName - Millicast Stream Name.
   * @param {onUserCountCallback} callback - Callback function executed when a new message is available.
   * @example
   * import MillicastStreamEvents from 'millicast-sdk-js'
   *
   * //Create a new instance
   * const streamEvents = await MillicastStreamEvents.init()
   * const accountId = "Publisher account ID"
   * const streamName = "Stream Name"
   *
   * //Initializes the user count event
   * streamEvents.onUserCount(accountId, streamName, (data) => {
   *  if (data.error) {
   *    console.error("Handle error: ", error)
   *  }
   *  else {
   *    console.log("Viewers: ", data.count)
   *  }
   * })
   */
  onUserCount (accountId, streamName, callback) {
    if (!this.millicastEventSubscriber) {
      logger.error('You need to initialize stream event with MillicastStreamEvents.init()')
      return
    }

    logger.info(`Starting user count. AccountId: ${accountId}, streamName: ${streamName}`)
    const streamId = `${accountId}/${streamName}`
    const userCountRequest = {
      arguments: [[streamId]],
      invocationId: (invocationId++).toString(),
      streamIds: [],
      target: USER_COUNT_TARGET,
      type: 1
    }
    this.millicastEventSubscriber.subscribe(userCountRequest)
    this.millicastEventSubscriber.on('message', (response) => {
      handleStreamCountResponse(streamId, response, callback)
    })
  }

  /**
   * Stop listening to stream events connected.
   * @example streamEvents.stop()
   */
  stop () {
    this.millicastEventSubscriber.close()
  }
}

const handleStreamCountResponse = (streamIdConstraint, response, callback) => {
  switch (response.type) {
    case messageType.REQUEST:
      if (response.target !== USER_COUNT_TARGET) {
        for (const { streamId, count } of response.arguments) {
          if (streamId === streamIdConstraint) {
            const countChange = { streamId, count }
            logger.debug('User count changed: ', countChange)
            callback(countChange)
          }
        }
      }
      break

    case messageType.RESPONSE:
      if (response.error && response.arguments.streamId === streamIdConstraint) {
        const countData = {
          error: response.error,
          streamId: response.arguments.streamId,
          count: response.arguments?.count
        }
        logger.error('User count error: ', response.error)
        callback(countData)
      }
      break

    default:
      break
  }
}