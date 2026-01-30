import unittest
from app import app
import os

class FlaskAppTests(unittest.TestCase):
    def setUp(self):
        # Set up test environment
        app.config['TESTING'] = True
        app.config['DATABASE_FILE'] = 'recordings/test_metadata.db'
        self.app = app.test_client()

    def tearDown(self):
        # Clean up test database if created
        if os.path.exists('recordings/test_metadata.db'):
            os.remove('recordings/test_metadata.db')

    def test_index_page(self):
        """Test if the main page loads correctly"""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

    def test_recordings_api(self):
        """Test if the recordings API returns a list"""
        response = self.app.get('/recordings')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json, list)

if __name__ == '__main__':
    unittest.main()
