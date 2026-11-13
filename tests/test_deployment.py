"""Pastikan build React benar-benar dilayani oleh server production."""
import re
from fastapi.testclient import TestClient
from backend.main import app, FRONTEND_DIST


def test_built_frontend_and_api_share_one_server():
    assert (FRONTEND_DIST / 'index.html').exists(), 'Jalankan npm run build di frontend sebelum tes deployment.'
    with TestClient(app) as client:
        response = client.get('/')
        assert response.status_code == 200
        assert 'text/html' in response.headers['content-type']
        assert '<div id="root">' in response.text
        assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', response.text)
        assert assets
        for asset in assets:
            assert client.get(asset).status_code == 200
        assert client.get('/api/health').json() == client.get('/health').json()
        assert client.get('/api/catalog').json()['internship_candidates'] == 25
        result = client.post('/api/recommend', json={'skills': ['communication'], 'method': 'tfidf'})
        assert result.status_code == 200 and result.json()['results']
        assert client.get('/api/missing').status_code == 404
        assert client.get('/.env').status_code == 404
