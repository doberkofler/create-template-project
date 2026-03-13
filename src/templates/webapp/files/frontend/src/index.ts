console.log('Hello from Vanilla JS Frontend!');
void fetch('/api/hello')
	.then((res) => res.json())
	.then((data) => console.log(data.message));
