import { FakeMessageProducer } from "./fake-message-producer";
import { FakeMessageConsumer } from "./fake-message-consumer";
import { FakeConnection } from "./fake-connection";
import { MessageService } from "@/message-service";
import { JsConnection } from "@/js-connection";
import { Message } from "@/message";
import { ResolveFunction } from "@/deferred";

// TODO: convert to BDD tests - encapsulate setups/execution/verification in given/when/then where possible
// TODO: split up into separate tests for PTP/pub-sub, message service and components

let messageService: MessageService;

// --------------------------------------------------------------------------------------------------------------------

beforeEach(() => {
    messageService = new MessageService();
});

// --------------------------------------------------------------------------------------------------------------------

afterEach(() => {
    messageService.close();
});

// --------------------------------------------------------------------------------------------------------------------

test("is open for extension via custom message consumers", async () => {
    const queueName = "/some/queue";
    const expectedMessageBody = { test: "foo" };
    const connection = new FakeConnection();
    const queue = connection.createQueue(queueName);
    const messageConsumer = connection.getConsumer(queue) as FakeMessageConsumer;
    const promise = messageConsumer.receive().promise;

    messageConsumer.emit(MessageService.createMessage(queueName, expectedMessageBody));

    const actualMessage = await promise;
    expect(actualMessage.body).toEqual(expectedMessageBody);

    queue.close();
});

// --------------------------------------------------------------------------------------------------------------------

test("the message service provides a facade for custom message consumers", async () => {
    const queueName = "/some/queue";
    const expectedMessageBody = { test: "foo" };
    const connection = new FakeConnection();
    const queue = messageService.createQueue(connection, queueName);
    const messageConsumer = connection.getConsumer(queue) as FakeMessageConsumer;
    const promise = messageService.receive(queueName).promise;

    messageConsumer.emit(MessageService.createMessage(queueName, expectedMessageBody));

    const actualMessage = await promise;
    expect(actualMessage.body).toEqual(expectedMessageBody);

    queue.close();
});

// --------------------------------------------------------------------------------------------------------------------

test("is open for extension via custom message producers", async () => {
    const queueName = "/some/queue";
    const expectedMessageBody = { test: "foo" };
    const connection = new FakeConnection();
    const queue = messageService.createQueue(connection, queueName);
    const messageProducer = connection.getProducer(queue) as FakeMessageProducer;
    expect(messageProducer.getLastMessage()).toBeUndefined();
    
    messageService.send(queueName, expectedMessageBody);

    const lastMessage = messageProducer.getLastMessage();
    expect(lastMessage).toBeDefined();
    expect(lastMessage.body).toEqual(expectedMessageBody);

    queue.close();
});

// --------------------------------------------------------------------------------------------------------------------

test("a queue delivers a message immediately if a receiver is already registered", async () => {
    const queueName = "/some/queue";
    const expectedMessageBody = { test: "foo" };
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);
    const promise = messageService.receive(queueName).promise;

    messageService.send(queueName, expectedMessageBody);

    const actualMessage = await promise;
    expect(actualMessage.body).toEqual(expectedMessageBody);
});

// --------------------------------------------------------------------------------------------------------------------

test("a queue receiver can fetch a pending message after registration", async () => {
    const queueName = "/some/queue";
    const expectedMessageBody = { test: "foo" };
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);

    messageService.send(queueName, expectedMessageBody);

    const actualMessage = await messageService.receive(queueName).promise;
    expect(actualMessage.body).toEqual(expectedMessageBody);
});

// --------------------------------------------------------------------------------------------------------------------

test("that a queue delivers any number of messages immediately if one or more receivers are already registered", async () => {
    const queueName = "/some/queue";
    const firstExpectedMessageBody = { test: "1" };
    const secondExpectedMessageBody = { test: "2" };
    const thirdExpectedMessageBody = { test: "3" };
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);
    const firstMessagePromise = messageService.receive(queueName).promise;
    const secondMessagePromise = messageService.receive(queueName).promise;
    const thirdMessagePromise = messageService.receive(queueName).promise;

    messageService.send(queueName, firstExpectedMessageBody);
    messageService.send(queueName, secondExpectedMessageBody);
    messageService.send(queueName, thirdExpectedMessageBody);

    const firstMessage = await firstMessagePromise;
    expect(firstMessage.body).toEqual(firstExpectedMessageBody);
    const secondMessage = await secondMessagePromise;
    expect(secondMessage.body).toEqual(secondExpectedMessageBody);
    const thirdMessage = await thirdMessagePromise;
    expect(thirdMessage.body).toEqual(thirdExpectedMessageBody);
 });
    
// --------------------------------------------------------------------------------------------------------------------

test("a queue delivers pending messages in the order they were sent", async () => {
    const queueName = "/some/queue";
    const firstExpectedMessageBody = { test: "1" };
    const secondExpectedMessageBody = { test: "2" };
    const thirdExpectedMessageBody = { test: "3" };
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);

    messageService.send(queueName, firstExpectedMessageBody);
    messageService.send(queueName, secondExpectedMessageBody);
    messageService.send(queueName, thirdExpectedMessageBody);

    let actualMessage = await messageService.receive(queueName).promise;
    expect(actualMessage.body).toEqual(firstExpectedMessageBody);
    actualMessage = await messageService.receive(queueName).promise;
    expect(actualMessage.body).toEqual(secondExpectedMessageBody);
    actualMessage = await messageService.receive(queueName).promise;
    expect(actualMessage.body).toEqual(thirdExpectedMessageBody);
});

// --------------------------------------------------------------------------------------------------------------------
test("that a queue any messages in correct order if one or more receivers are already registered", async () => {
    const queueName = "/some/queue";
    const firstExpectedMessageBody = { test: "1" };
    const secondExpectedMessageBody = { test: "2" };
    const thirdExpectedMessageBody = { test: "3" };
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);

    const firstMessagePromise = messageService.receive(queueName).promise;
    const secondMessagePromise = messageService.receive(queueName).promise;
    messageService.send(queueName, firstExpectedMessageBody);
    const thirdMessagePromise = messageService.receive(queueName).promise;
    messageService.send(queueName, secondExpectedMessageBody);
    messageService.send(queueName, thirdExpectedMessageBody);

    const thirdMessage = await thirdMessagePromise;
    expect(thirdMessage.body).toEqual(thirdExpectedMessageBody);
    const secondMessage = await secondMessagePromise;
    expect(secondMessage.body).toEqual(secondExpectedMessageBody);
    const firstMessage = await firstMessagePromise;
    expect(firstMessage.body).toEqual(firstExpectedMessageBody);
});
    
// --------------------------------------------------------------------------------------------------------------------

test("message service creates a default body to queue messages if none was specified", async () => {
    const queueName = "/some/queue";
    const expectedMessageBody = {};
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);

    const promise = messageService.receive(queueName).promise;
    messageService.send(queueName);

    const actualMessage = await promise;
    expect(actualMessage.body).toEqual(expectedMessageBody);
});

// --------------------------------------------------------------------------------------------------------------------

test("a queue receiver can send a response when the message is sent after registration of the receiver", async () => {
    const queueName = "/some/queue";
    const messageBody = { test: "foo" };
    const expectedResponseBody = { response: "payload" };
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);

    messageService.receive(queueName)
        .then((message: Message, resolve: ResolveFunction<object>) => {
            resolve(expectedResponseBody);
        });

    const response = await messageService.send(queueName, messageBody);
    expect(response).toEqual(expectedResponseBody);
});

// --------------------------------------------------------------------------------------------------------------------

test("a queue receiver can send a response when the message is sent before registration of the receiver", async () => {
    const queueName = "/some/queue";
    const messageBody = { test: "foo" };
    const expectedResponseBody = { response: "payload" };
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);

    const promise = messageService.send(queueName, messageBody);

    messageService.receive(queueName)
        .then((message: Message, resolve: ResolveFunction<object>) => {
            resolve(expectedResponseBody);
        });

    const response = await promise;
    expect(response.body).toEqual(expectedResponseBody);
});

// --------------------------------------------------------------------------------------------------------------------

test("a queue removes expired messages", async (done) => {
    const queueName = "/some/queue";
    const messageBody = { test: "foo" };
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);
    let receivedExpiredMessage = false;

    messageService.send(queueName, messageBody, 100);

    const expiration = new Promise((resolve, reject) => {
        setTimeout(() => {resolve()}, 150);
    });
    await expiration;
    
    messageService.receive(queueName)
        .then((message: Message, resolve: ResolveFunction<object>) => {
            receivedExpiredMessage = true;
        });
    
    setTimeout(() => {
        expect(receivedExpiredMessage).toBeFalsy();
        done();
    }, 1);
});

// --------------------------------------------------------------------------------------------------------------------

test("a message queue catches exceptions thrown by consumers and then rejects the promise", async () => {
    const queueName = "/some/queue";
    const messageBody = { test: "foo" };
    const connection = new JsConnection();
    const queue = messageService.createQueue(connection, queueName);
    
    const promise = messageService.send(queueName, messageBody);

    messageService.receive(queueName)
        .then((message: Message, resolve: ResolveFunction<object>) => {
            throw new Error("which should be caught and reject the sender promise");
        });

    await expect(promise).rejects.toThrowError();
});

// --------------------------------------------------------------------------------------------------------------------

// test("a queued message is deleted after successful delivery", async () => {
//     const queueName = "/some/queue";
//     const messageBody = { test: "foo" };
//     let secondDelivery = false;

//     const promise = messageService.send(queueName, messageBody);

//     messageService.receive(queueName)
//         .then((message: Message, resolve: ResolveFunction<object>) => {
//             // NOTE: the message is now considered to be sucessfully delivered 
//             // Any errors during consuming the message mustn't change the successful delivery status:
//             throw new Error("should be caught");
//         });

//     await expect(promise).rejects.toThrowError();

//     messageService.receive(queueName)
//         .then((message: Message, resolve: ResolveFunction<object>) => {
//             secondDelivery = true;
//         });

//     expect(secondDelivery).toBeFalsy();
// });

// // --------------------------------------------------------------------------------------------------------------------

// test("a topic message is published to all subscribers", () => {
//     const topicName = "/some/topic";
//     const expectedMessageBody = { test: "foo" };
//     let receivedCount = 0;

//     messageService.subscribe(topicName, (actualMessage: Message) => { 
//         expect(actualMessage.body).toEqual(expectedMessageBody);
//         receivedCount++; 
//     });
//     messageService.subscribe(topicName, (actualMessage: Message) => { 
//         expect(actualMessage.body).toEqual(expectedMessageBody);
//         receivedCount++; 
//     });

//     messageService.publish(topicName, expectedMessageBody);

//     expect(receivedCount).toBe(2);
// });

// // --------------------------------------------------------------------------------------------------------------------

// test("a subscriber is only called once", () => {
//     const topicName = "/some/topic";
//     const messageBody = { test: "foo" };
//     let receivedCount = 0;

//     const subscriber = (message: Message) => { receivedCount++; }
//     messageService.subscribe(topicName, subscriber);
//     messageService.subscribe(topicName, subscriber);

//     messageService.publish(topicName, messageBody);

//     expect(receivedCount).toBe(1);
// });

// // --------------------------------------------------------------------------------------------------------------------

// test("a message is only published to it's topic subscribers", () => {
//     let received = false;

//     messageService.subscribe("/interesting/topic", (message: Message) => { received = true });
//     messageService.publish("/uninteresting/topic", {});

//     expect(received).toBeFalsy();
// });
   
// // --------------------------------------------------------------------------------------------------------------------

// test("message service creates default body to topic messages if none was specified", async () => {
//     const topicName = "/some/topic";
//     const expectedMessageBody = {};
//     let actualMessageBody = null;

//     messageService.subscribe(topicName, (message: Message) => { 
//         actualMessageBody = message.body;
//     });
//     messageService.publish(topicName);

//     expect(actualMessageBody).toEqual(expectedMessageBody);
// });

// // --------------------------------------------------------------------------------------------------------------------

// TODO: support for multiple queues

// TODO: support for multiple topics

// TODO: receiveSync()