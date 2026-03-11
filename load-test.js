import http from 'k6/http';
import { check } from 'k6';

export const options = {
    vus: 100,
    duration: '30s',
};

export default function () {
    const url = 'http://localhost:5001/api/test';

    const res = http.get(url);

    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
    });
}