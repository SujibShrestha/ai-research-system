from agents import build_search_agent, build_reader_agent, writer_chain, critic_prompt

def run_research_pipeline(topic:str)-> dict:
    state ={}

    # search_agent

    print('\n ---------------------------------------')
    search_agent = build_search_agent()
    search_result = search_agent.invoke({
        "messages":[
            ("user", f"Search for information about {topic}")
        ]
    })

    state['search_result'] = search_result['messages'][-1].content

    print('\n Search Result: ', state['search_result'])

    # reader_agent
    print('\n ---------------------------------------')
    reader_agent = build_reader_agent()
    reader_result = reader_agent.invoke({
        'messages':[
            ('user',f'Based on the following search result about {topic}.'
           f"pick the most relevant URL and scrape it for deeper content.\n\n"
           f"Search Result: {state['search_result'][:800]}"
           )]})

    state['scraped_content'] = reader_result['messages'][-1].content

    print('\n Scraped Content: ', state['scraped_content'][:800]) 

    # writer_chain
    print('\n ---------------------------------------')
    research_combined = (
        f"Search results: \n {state['search_result']}\n\n"
        f"Scraped content: \n {state['scraped_content']}"
    )        

    state['report'] = writer_chain.invoke({
        'topic': topic,
        'research': research_combined
    })

    print('\n Final Report: ', state['report'])


    #critic report
    print('\n ---------------------------------------')
    state['feedback'] = critic_prompt.invoke({
        'report': state['report']
    })

    return state


if __name__ == "__main__":
    topic = input("\nEnter a topic to research: ")
    run_research_pipeline(topic)