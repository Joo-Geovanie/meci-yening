"""Uji CV memakai data sintetis; tidak mengirim CV ke layanan cloud."""
from io import BytesIO
from zipfile import ZipFile
import httpx
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from backend.cv import MAX_CV_BYTES, extract_skills
from backend.main import app


def test_text_skills_boundaries_and_docx():
    vocabulary = ['java', 'javascript', 'python', 'c++', 'sql']
    result = extract_skills(b'Python, JavaScript and C++. SQL projects.', 'txt', vocabulary)
    assert result['skills'] == ['c++', 'javascript', 'python', 'sql']
    stream = BytesIO()
    with ZipFile(stream, 'w') as archive:
        archive.writestr('word/document.xml', '<document><p>Python</p><p>SQL</p></document>')
    assert extract_skills(stream.getvalue(), 'docx', vocabulary)['skills'] == ['python', 'sql']


def test_size_boundary_and_bad_files():
    assert extract_skills(b'python' + b' ' * (MAX_CV_BYTES - 6), 'txt', ['python'])['skills'] == ['python']
    for data, extension in [(b'x' * (MAX_CV_BYTES + 1), 'txt'), (b'', 'txt'), (b'fake pdf', 'pdf'), (b'bad zip', 'docx'), (b'\x00', 'txt')]:
        with pytest.raises(ValueError):
            extract_skills(data, extension, [])
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    pdf = BytesIO(); writer.write(pdf)
    with pytest.raises(ValueError, match='OCR'):
        extract_skills(pdf.getvalue(), 'pdf', [])


@pytest.fixture
def cv_api(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL', 'https://test.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY', 'test-publishable')
    state = {'uploads': [], 'auth': 200, 'storage': 200}
    def handler(request):
        assert request.headers['authorization'] == 'Bearer test-token'
        if request.url.path == '/auth/v1/user':
            return httpx.Response(state['auth'], json={'id': '11111111-1111-4111-8111-111111111111'})
        assert request.url.path.startswith('/storage/v1/object/cvs/11111111-1111-4111-8111-111111111111/')
        state['uploads'].append(request.content)
        return httpx.Response(state['storage'], json={})
    original = httpx.AsyncClient
    monkeypatch.setattr('backend.main.httpx.AsyncClient', lambda **kw: original(transport=httpx.MockTransport(handler), **kw))
    with TestClient(app) as client:
        yield client, state


def test_private_upload_then_recommend(cv_api):
    client, state = cv_api
    response = client.post('/cv?extension=txt', content=b'Python SQL communication recruitment', headers={'Authorization': 'Bearer test-token'})
    assert response.status_code == 200
    data = response.json()
    assert data['stored'] and data['skills'] and len(state['uploads']) == 1
    assert 'text' not in data
    result = client.post('/recommend', json={'skills': data['skills'], 'method': 'tfidf'})
    assert result.status_code == 200 and result.json()['results']
    assert all(0 <= row['score'] <= 100 for row in result.json()['results'])


def test_reject_unauthorized_large_and_failed_storage(cv_api):
    client, state = cv_api
    assert client.post('/cv?extension=txt', content=b'Python').status_code == 401
    headers = {'Authorization': 'Bearer test-token'}
    assert client.post('/cv?extension=txt', content=b'x' * (MAX_CV_BYTES + 1), headers=headers).status_code == 413
    assert not state['uploads']
    state['auth'] = 401
    assert client.post('/cv?extension=txt', content=b'Python', headers=headers).status_code == 401
    assert not state['uploads']
    state['auth'] = 200
    state['storage'] = 403
    response = client.post('/cv?extension=txt', content=b'Python', headers=headers)
    assert response.status_code == 502 and 'stored' not in response.json()
