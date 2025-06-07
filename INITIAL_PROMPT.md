I am trying to map the interaction between cli and core packages to the
conceptial architecture described in docs/architecture.md and it seems to me
that there's too much coupling beween those packages with no clear separation of
state and responsibilities.  Can you help with that refactoring? We should think
of the CLI as, essentially a "chat client" and the core as a "chat server." All
of the chat conversation state should be maintained in that server.  A client
may be stopped and restarted or there could be different chat clients trying to
communicate with the same server to participate in the same conversation.  And
while we are not going to move to a client/server model right now, I think this
framing can help us achieve the righ architecture boundaries. Let's start by
generating a detailed refactoring plan and writing it to a markdown file where I
can review it and tweak it.  Let's also make sure that this refactoring proceeds
in smallest possible steps, where at each state we have a fully buildable and
testable codebase.  Let's also make sure to write tests for the exiting code
before refactoring it, so that we can validate that we did not change its
behavior after the refactor.