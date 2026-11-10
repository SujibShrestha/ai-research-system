from langchain.tools import tool
import requests
from bs4 import BeautifulSoup
from tavily import TavilyClient
import os
from dotenv import load_dotenv
from urllib.parse import urlparse
load_dotenv()


tavily = TavilyClient(api_key= os.getenv("TAVILY_API_KEY"))

@tool 
def web_search(query:str)-> str:
    '''Search the web for recent and reliable information on the topic.
     
       Return the titles, urls and snippets'''
    results = tavily.search(query, max_results=5)

    out = []
    for result in results["results"]:
        title = result["title"]
        url = result["url"]
        snippet = result["content"]
        out.append(f"Title: {title}\nURL: {url}\nSnippet: {snippet}\n")

    return "\n".join(out)


@tool
def scrape_url(url: str) -> str:
    """Fetch a web page and return its title and visible text."""
    parsed_url = urlparse(url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("url must be an absolute HTTP or HTTPS URL")

    try:
        response = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=15,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f"Unable to fetch URL: {url}") from exc

    soup = BeautifulSoup(response.text, "html.parser")
    for element in soup(["script", "style", "noscript"]):
        element.decompose()

    return soup.get_text(separator=" ", strip=True)[:3000]

