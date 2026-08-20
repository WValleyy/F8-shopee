import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_SEED_DIR = path.dirname(fileURLToPath(import.meta.url));

const demoAccounts = Object.freeze({
    customer: Object.freeze({
        email: 'demo.customer@example.com',
        password: '123456',
        userName: 'demo_customer',
        name: 'Nguyễn Minh Anh',
        phone: '0901234567',
        gender: 'female',
        birthday: new Date('1998-06-18T00:00:00.000Z'),
    }),
    edge: Object.freeze({
        email: 'demo.edge@example.com',
        password: '123456',
        userName: 'demo_edge',
        name: 'Trần Quốc Bảo',
        phone: '0912345678',
        gender: 'male',
        birthday: new Date('1996-11-02T00:00:00.000Z'),
    }),
    admin: Object.freeze({
        email: 'admin@example.com',
        password: '123456',
        userName: 'admin_demo',
        name: 'F8 Shop Admin',
        phone: '0987654321',
        gender: 'other',
        birthday: null,
    }),
});

const namePool = Object.freeze([
    'Nguyễn Minh Khang', 'Trần Gia Hân', 'Lê Hoàng Nam', 'Phạm Thu Trang',
    'Võ Đức Anh', 'Đặng Ngọc Mai', 'Bùi Quốc Khánh', 'Đỗ Thanh Hà',
    'Nguyễn Tuấn Kiệt', 'Trần Khánh Linh', 'Lê Minh Quân', 'Phạm Bảo Ngọc',
    'Vũ Anh Tú', 'Hoàng Mai Anh', 'Ngô Thành Đạt', 'Dương Thảo Vy',
    'Đinh Quang Huy', 'Mai Phương Linh', 'Lý Hải Đăng', 'Tạ Minh Châu',
]);

const addressPool = Object.freeze([
    ['TP. Hồ Chí Minh', 'Phường Bến Nghé', '18 Nguyễn Huệ'],
    ['TP. Hồ Chí Minh', 'Phường Đa Kao', '42 Nguyễn Đình Chiểu'],
    ['Hà Nội', 'Phường Cửa Nam', '36 Tràng Thi'],
    ['Hà Nội', 'Phường Hàng Bạc', '25 Hàng Bạc'],
    ['Đà Nẵng', 'Phường Hải Châu', '67 Bạch Đằng'],
    ['Cần Thơ', 'Phường Ninh Kiều', '24 Nguyễn Trãi'],
    ['Hải Phòng', 'Phường Hồng Bàng', '55 Điện Biên Phủ'],
    ['Bình Dương', 'Phường Phú Cường', '81 Cách Mạng Tháng Tám'],
]);

const dataSeedConfig = Object.freeze({
    syntheticUserCount: 15,
    users: Object.freeze({
        demoAccounts,
        namePool,
        addressPool,
    }),
    productInfoPath: path.join(
        DATA_SEED_DIR,
        'product-data',
        'product-info.json',
    ),
    activity: Object.freeze({
        syntheticOrdersMin: 20,
        syntheticOrdersMax: 30,
        syntheticReturnUsers: 10,
        syntheticCartUsers: 4,
        syntheticWishlistMin: 6,
        syntheticWishlistMax: 20,
        reviewTarget: 300,
        featuredReviewTarget: 15,
    }),
});

export default dataSeedConfig;
