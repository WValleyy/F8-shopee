function freezeDefinition(statusCode, message) {
    return Object.freeze({ statusCode, message });
}

const ERROR_CONFIG = Object.freeze({
    // ==========================================
    // 1. SYSTEM & MIDDLEWARE ERRORS
    // ==========================================
    INTERNAL_SERVER_ERROR: freezeDefinition(500, 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.'),
    ROUTE_NOT_FOUND: freezeDefinition(404, 'Trang hoặc tài nguyên bạn yêu cầu không tồn tại.'),
    INVALID_JSON: freezeDefinition(400, 'Dữ liệu JSON không hợp lệ.'),
    PAYLOAD_TOO_LARGE: freezeDefinition(413, 'Dữ liệu gửi lên vượt quá giới hạn cho phép.'),
    INVALID_UPLOAD: freezeDefinition(400, 'Tệp tải lên không hợp lệ.'),
    UPLOAD_FILE_TOO_LARGE: freezeDefinition(413, 'Tệp tải lên vượt quá dung lượng cho phép.'),
    UPLOAD_TOO_MANY_FILES: freezeDefinition(400, 'Số lượng tệp tải lên vượt quá giới hạn cho phép.'),
    UPLOAD_TOO_MANY_FIELDS: freezeDefinition(400, 'Dữ liệu tải lên có quá nhiều trường.'),
    TOTAL_IMAGE_SIZE_EXCEEDED: freezeDefinition(413, ({ limitMegabytes }) => (
        limitMegabytes
            ? `Tổng dung lượng ảnh không được vượt quá ${limitMegabytes} MB.`
            : 'Tổng dung lượng ảnh vượt quá giới hạn cho phép.'
    )),
    IMAGE_TYPE_INVALID: freezeDefinition(400, 'Ảnh phải là tệp JPEG, PNG hoặc WebP hợp lệ.'),
    IMAGE_FILE_TOO_LARGE: freezeDefinition(413, ({ limitMegabytes }) => (
        `Dung lượng mỗi ảnh không được vượt quá ${limitMegabytes} MB.`
    )),
    CSRF_VALIDATION_FAILED: freezeDefinition(403, 'Bạn đang gửi yêu cầu từ một domain không hợp lệ.'),
    ADMIN_ROLE_REQUIRED: freezeDefinition(403, 'Tài khoản hiện tại không có vai trò quản trị viên.'),
    CUSTOMER_ACCOUNT_REQUIRED: freezeDefinition(403, 'Chức năng này chỉ dành cho tài khoản khách hàng.'),
    CHECKOUT_USER_UNAVAILABLE: freezeDefinition(403, 'Tài khoản không thể thực hiện thanh toán.'),
    RATE_LIMITED: freezeDefinition(429, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.'),

    // ==========================================
    // 2. GENERIC REQUEST & VALIDATION ERRORS
    // ==========================================
    REQUEST_BODY_INVALID: freezeDefinition(400, 'Dữ liệu yêu cầu phải là một object.'),
    FIELD_REQUIRED: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} là bắt buộc.`),
    FIELD_INVALID: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} không hợp lệ.`),
    FIELD_MUST_BE_STRING: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} phải là chuỗi.`),
    FIELD_MUST_BE_BOOLEAN: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} phải là giá trị boolean.`),
    FIELD_MUST_BE_NUMBER: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} phải là số.`),
    FIELD_MUST_BE_INTEGER: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} phải là số nguyên.`),
    FIELD_MUST_BE_POSITIVE_INTEGER: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} phải là số nguyên dương.`),
    FIELD_MUST_BE_NON_NEGATIVE_INTEGER: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} phải là số nguyên không âm.`),
    FIELD_OUT_OF_RANGE: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} nằm ngoài phạm vi cho phép.`),
    FIELD_LENGTH_INVALID: freezeDefinition(400, ({ fieldLabel, minLength, maxLength }) => (
        `${fieldLabel} phải có từ ${minLength} đến ${maxLength} ký tự.`
    )),
    FIELD_MUST_BE_ARRAY: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} phải là danh sách.`),
    FIELD_MUST_BE_NON_EMPTY_ARRAY: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} không được để trống.`),
    FIELD_ITEM_COUNT_INVALID: freezeDefinition(400, ({ fieldLabel }) => `Số lượng phần tử của ${fieldLabel} không hợp lệ.`),
    FIELD_TOO_MANY_ITEMS: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} chứa quá nhiều phần tử.`),
    FIELD_MUST_BE_JSON: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} phải là JSON hợp lệ.`),
    FIELD_MUST_BE_JSON_ARRAY: freezeDefinition(400, ({ fieldLabel }) => `${fieldLabel} phải là một mảng JSON hợp lệ.`),
    NO_FIELDS_TO_UPDATE: freezeDefinition(400, 'Không có dữ liệu nào để cập nhật.'),

    MAXIMUM_SPEND_BELOW_MINIMUM: freezeDefinition(400, 'Chi tiêu tối đa không được nhỏ hơn chi tiêu tối thiểu.'),

    // ==========================================
    // 3. AUTHENTICATION & SESSION ERRORS
    // ==========================================
    INVALID_EMAIL: freezeDefinition(400, 'Email không hợp lệ.'),
    PASSWORD_CONFIRMATION_MISMATCH: freezeDefinition(400, 'Mật khẩu xác nhận không khớp.'),
    NEW_PASSWORD_MUST_DIFFER: freezeDefinition(400, 'Mật khẩu mới phải khác mật khẩu hiện tại.'),
    INVALID_OTP: freezeDefinition(400, 'Mã OTP không hợp lệ.'),
    INVALID_SESSION_ID: freezeDefinition(400, 'Mã phiên đăng nhập không hợp lệ.'),
    EMAIL_ALREADY_EXISTS: freezeDefinition(409, 'Email đã tồn tại.'),
    INVALID_CREDENTIALS: freezeDefinition(401, 'Email hoặc mật khẩu không chính xác.'),
    SESSION_LIMIT_REACHED: freezeDefinition(409, 'Bạn đã đạt giới hạn số phiên đăng nhập.'),
    SESSION_INVALID: freezeDefinition(401, 'Phiên đăng nhập không còn hợp lệ.'),
    SESSION_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy phiên đăng nhập.'),
    EMAIL_VERIFICATION_REQUIRED: freezeDefinition(403, 'Vui lòng xác minh email hiện tại trước khi thay đổi email.'),
    CURRENT_PASSWORD_INCORRECT: freezeDefinition(400, 'Mật khẩu hiện tại không chính xác.'),
    CURRENT_PASSWORD_REQUIRED: freezeDefinition(400, 'Vui lòng nhập mật khẩu hiện tại.'),
    NEW_EMAIL_MUST_DIFFER: freezeDefinition(400, 'Email mới phải khác email hiện tại.'),
    ACCOUNT_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy tài khoản.'),
    VERIFICATION_CODE_INVALID_OR_EXPIRED: freezeDefinition(400, 'Mã xác minh không hợp lệ hoặc đã hết hạn.'),
    VERIFICATION_CODE_EXPIRED: freezeDefinition(400, 'Mã xác minh đã hết hạn.'),
    VERIFICATION_CODE_EXPIRED_REQUEST_NEW: freezeDefinition(400, 'Mã xác minh đã hết hạn. Vui lòng yêu cầu mã mới.'),
    USER_EMAIL_CHANGED: freezeDefinition(409, 'Email tài khoản đã thay đổi. Vui lòng yêu cầu mã mới.'),
    PASSWORD_RESET_SESSION_INVALID: freezeDefinition(400, 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'),
    ACCESS_TOKEN_EXPIRED: freezeDefinition(401, 'Phiên đăng nhập đã hết hạn.'),
    ACCESS_TOKEN_MISSING: freezeDefinition(401, 'Bạn cần đăng nhập để tiếp tục.'),
    ACCESS_TOKEN_INVALID: freezeDefinition(401, 'Phiên đăng nhập không hợp lệ.'),
    REFRESH_TOKEN_EXPIRED: freezeDefinition(401, 'Phiên đăng nhập đã hết hạn.'),
    REFRESH_TOKEN_INVALID: freezeDefinition(401, 'Phiên đăng nhập không hợp lệ.'),
    REFRESH_TOKEN_REUSED: freezeDefinition(401, 'Phiên đăng nhập không còn an toàn. Vui lòng đăng nhập lại.'),
    REFRESH_ROTATION_CONFLICT: freezeDefinition(409, 'Phiên đăng nhập vừa được làm mới. Vui lòng thử lại.'),
    SESSION_ABSOLUTE_EXPIRED: freezeDefinition(401, 'Phiên đăng nhập đã hết hạn.'),
    SESSION_IDLE_EXPIRED: freezeDefinition(401, 'Phiên đăng nhập đã hết hạn do không hoạt động.'),
    SESSION_REVOKED: freezeDefinition(401, 'Phiên đăng nhập đã bị thu hồi.'),

    // ==========================================
    // 4. USER & ACCOUNT MANAGEMENT ERRORS
    // ==========================================
    USER_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy người dùng.'),
    ADDRESS_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy địa chỉ.'),
    DEFAULT_ADDRESS_CANNOT_DELETE: freezeDefinition(409, 'Không thể xóa địa chỉ mặc định. Vui lòng thiết lập địa chỉ khác làm mặc định trước.'),
    DEFAULT_ADDRESS_CHANGED: freezeDefinition(409, 'Địa chỉ mặc định vừa thay đổi. Vui lòng thử lại.'),
    DEFAULT_ADDRESS_STATE_CHANGED: freezeDefinition(409, 'Trạng thái địa chỉ mặc định vừa thay đổi. Vui lòng thử lại.'),
    ADDRESS_LIMIT_REACHED: freezeDefinition(409, ({ limit }) => `Bạn chỉ có thể lưu tối đa ${limit} địa chỉ.`),
    NOTIFICATION_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy thông báo.'),
    INVALID_PHONE: freezeDefinition(400, 'Số điện thoại không hợp lệ.'),
    PHONE_MUST_BE_STRING: freezeDefinition(400, 'Số điện thoại phải là chuỗi.'),
    INVALID_BIRTHDAY: freezeDefinition(400, 'Ngày sinh không hợp lệ.'),
    USERNAME_CONTAINS_SPACES: freezeDefinition(400, 'Tên người dùng không được chứa khoảng trắng.'),

    ACCOUNT_HAS_OPEN_ORDERS: freezeDefinition(409, 'Vui lòng hoàn tất, hủy hoặc xử lý xong hoàn tiền cho tất cả đơn hàng trước khi xóa tài khoản.'),
    ACCOUNT_PURGE_NOT_READY: freezeDefinition(409, 'Chưa đến thời điểm có thể xóa vĩnh viễn tài khoản này.'),
    ACCOUNT_DELETION_NOT_SCHEDULED: freezeDefinition(400, 'Tài khoản chưa yêu cầu xóa.'),
    ACCOUNT_PURGE_FAILED: freezeDefinition(400, 'Không thể xóa vĩnh viễn tài khoản này.'),
    CANNOT_PURGE_CURRENT_ADMIN: freezeDefinition(400, 'Không thể xóa tài khoản quản trị viên đang đăng nhập.'),
    CANNOT_CHANGE_ADMIN_STATUS: freezeDefinition(400, 'Không thể thay đổi trạng thái của tài khoản quản trị viên.'),

    // ==========================================
    // 5. PRODUCT & CATALOG ERRORS
    // ==========================================
    PRODUCT_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy sản phẩm.'),
    PRODUCT_SLUG_INVALID: freezeDefinition(400, 'Đường dẫn sản phẩm không hợp lệ.'),
    CATALOG_SORT_INVALID: freezeDefinition(400, 'Cách sắp xếp không hợp lệ.'),
    REVIEW_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy đánh giá.'),
    REVIEW_RATING_INVALID: freezeDefinition(400, 'Điểm đánh giá không hợp lệ.'),
    REVIEW_ORDER_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy đơn hàng để đánh giá.'),
    REVIEW_ORDER_NOT_COMPLETED: freezeDefinition(400, 'Chỉ có thể đánh giá sản phẩm trong đơn hàng đã hoàn thành.'),
    REVIEW_ITEM_NOT_PURCHASED: freezeDefinition(400, 'Sản phẩm không thuộc đơn hàng này.'),
    REVIEW_ITEM_FULLY_RETURNED: freezeDefinition(400, 'Sản phẩm đã được trả hết nên không thể đánh giá.'),
    REVIEW_ALREADY_EXISTS: freezeDefinition(409, 'Sản phẩm này đã được đánh giá trong lần mua này.'),
    PRODUCT_CATEGORY_UNAVAILABLE: freezeDefinition(400, 'Danh mục không tồn tại hoặc đã bị khóa.'),
    PRODUCT_CATEGORY_NOT_LEAF: freezeDefinition(400, 'Sản phẩm phải thuộc một danh mục cụ thể.'),
    PRODUCT_SLUG_CONFLICT: freezeDefinition(409, 'Tên sản phẩm tạo ra đường dẫn đã tồn tại. Vui lòng đổi tên sản phẩm.'),
    PRODUCT_EDIT_CONFLICT: freezeDefinition(409, 'Sản phẩm hoặc tồn kho vừa được cập nhật. Vui lòng tải lại và thử lại.'),
    PRODUCT_REQUIRES_VARIANT: freezeDefinition(400, 'Sản phẩm phải có ít nhất một phiên bản.'),
    PUBLISHED_PRODUCT_REQUIRES_PUBLISHED_VARIANT: freezeDefinition(400, 'Sản phẩm đang hiển thị phải có ít nhất một phiên bản đang hiển thị.'),
    PRODUCT_VARIANT_LIMIT_REACHED: freezeDefinition(400, ({ limit }) => `Sản phẩm chỉ có thể có tối đa ${limit} phiên bản.`),
    PRODUCT_VARIANT_OPTION_NAME_DUPLICATED: freezeDefinition(400, ({ optionName }) => `Tên phân loại "${optionName}" bị lặp trong cùng một phiên bản.`),
    PRODUCT_VARIANT_IMAGE_REQUIRED: freezeDefinition(400, 'Mỗi phiên bản phải có ảnh.'),
    PRODUCT_VARIANT_IMAGE_NOT_FOUND: freezeDefinition(400, 'Không tìm thấy ảnh được gán cho phiên bản.'),
    PRODUCT_VARIANT_IMAGE_DUPLICATED: freezeDefinition(400, 'Một tệp ảnh không thể được gán cho nhiều phiên bản.'),
    PRODUCT_VARIANT_IMAGE_UNASSIGNED: freezeDefinition(400, 'Có ảnh phiên bản chưa được sử dụng.'),
    PRODUCT_IMAGE_LIMIT_REACHED: freezeDefinition(400, 'Sản phẩm có quá nhiều ảnh.'),
    PRODUCT_RETAINED_IMAGES_INVALID: freezeDefinition(400, 'Danh sách ảnh hiện tại không hợp lệ.'),
    PRODUCT_ACTION_INVALID: freezeDefinition(400, 'Thao tác sản phẩm không hợp lệ.'),
    PRODUCT_VALIDATION_FAILED: freezeDefinition(400, 'Dữ liệu sản phẩm không hợp lệ.'),
    PRODUCT_VARIANT_HAS_ORDERS: freezeDefinition(409, 'Phiên bản đã phát sinh đơn hàng, không thể xóa vĩnh viễn. Vui lòng bỏ chọn "Hiển thị" nếu muốn ngừng bán.'),
    PRODUCT_DELETE_CONFLICT: freezeDefinition(409, 'Sản phẩm đang được cập nhật hoặc phát sinh giao dịch khác. Vui lòng tải lại và thử lại.'),
    PRODUCT_HAS_ORDERS: freezeDefinition(409, 'Sản phẩm đã phát sinh đơn hàng nên không thể xóa vĩnh viễn. Vui lòng ẩn sản phẩm nếu muốn ngừng bán.'),

    // ==========================================
    // 6. CART & CHECKOUT ERRORS
    // ==========================================
    CHECKOUT_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy phiên thanh toán.'),
    CHECKOUT_EXPIRED: freezeDefinition(404, 'Phiên thanh toán không còn khả dụng.'),
    CHECKOUT_ITEMS_UNAVAILABLE: freezeDefinition(409, 'Một hoặc nhiều phiên bản trong đơn hàng không còn khả dụng. Vui lòng quay lại giỏ hàng và chọn lại sản phẩm.'),
    CHECKOUT_ORDER_LIMIT_EXCEEDED: freezeDefinition(400, 'Đơn hàng vượt quá giới hạn giá trị cho phép.'),
    CHECKOUT_ALREADY_CREATED: freezeDefinition(409, 'Phiên thanh toán này đã được dùng để đặt hàng.'),
    CHECKOUT_ACTIVE_LIMIT_REACHED: freezeDefinition(409, ({ limit }) => `Bạn chỉ có thể giữ tối đa ${limit} phiên thanh toán đang hoạt động.`),
    CART_ITEM_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy sản phẩm trong giỏ hàng.'),
    CART_ITEMS_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy một hoặc nhiều sản phẩm trong giỏ hàng.'),
    CART_ITEM_LIMIT_REACHED: freezeDefinition(409, ({ limit }) => `Giỏ hàng chỉ có thể chứa tối đa ${limit} sản phẩm.`),
    CART_ITEM_QUANTITY_INVALID: freezeDefinition(400, 'Số lượng sản phẩm không hợp lệ.'),
    CART_ITEM_INVALID: freezeDefinition(400, 'Sản phẩm trong giỏ hàng không hợp lệ.'),

    // ==========================================
    // 7. ORDER & RETURN ERRORS
    // ==========================================
    ORDER_STATUS_UPDATE_FAILED: freezeDefinition(400, 'Không thể cập nhật trạng thái đơn hàng.'),
    ADMIN_ORDER_TRANSITION_INVALID: freezeDefinition(400, 'Không thể chuyển trạng thái đơn hàng hiện tại.'),
    ADMIN_ORDER_CANCEL_INVALID: freezeDefinition(400, 'Đơn hàng không còn ở trạng thái có thể hủy thủ công.'),
    ORDER_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy đơn hàng.'),
    RETURN_ITEMS_REQUIRED: freezeDefinition(400, 'Danh sách sản phẩm hoàn trả không được để trống.'),
    RETURN_ITEMS_LIMIT_EXCEEDED: freezeDefinition(
        400,
        ({ limit }) => `Chỉ có thể trả tối đa ${limit} sản phẩm trong một yêu cầu.`,
    ),
    RETURN_ITEM_INVALID: freezeDefinition(400, 'Sản phẩm hoàn trả không hợp lệ.'),
    RETURN_QUANTITY_INVALID: freezeDefinition(400, 'Số lượng hoàn trả không hợp lệ.'),
    RETURN_REQUEST_KEY_USED: freezeDefinition(409, 'Mã yêu cầu này đã được sử dụng.'),
    ORDER_RETURN_NOT_ALLOWED: freezeDefinition(400, 'Chỉ đơn hàng đã hoàn thành mới có thể yêu cầu trả hàng.'),
    ORDER_RETURN_PERIOD_EXPIRED: freezeDefinition(400, 'Thời hạn yêu cầu trả hàng đã kết thúc.'),
    ORDER_RETURN_ITEM_INVALID: freezeDefinition(400, 'Sản phẩm được chọn không thuộc đơn hàng này.'),
    ORDER_RETURN_QUANTITY_EXCEEDED: freezeDefinition(400, ({ productName }) => `${productName} không còn đủ số lượng có thể hoàn trả.`),

    // ==========================================
    CATEGORY_SELF_PARENT: freezeDefinition(400, 'Danh mục không thể là danh mục cha của chính nó.'),
    CATEGORY_PARENT_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy danh mục cha.'),
    CATEGORY_PARENT_HAS_PRODUCTS: freezeDefinition(409, 'Danh mục cha đang chứa sản phẩm trực tiếp. Hãy tạo danh mục Khác và chuyển sản phẩm trước.'),
    CATEGORY_OTHER_MUST_BE_LEAF: freezeDefinition(400, 'Danh mục Khác nhận sản phẩm phải là danh mục lá.'),
    CATEGORY_PARENT_CYCLE: freezeDefinition(400, 'Quan hệ danh mục cha tạo thành vòng lặp.'),
    CATEGORY_NOT_FOUND: freezeDefinition(404, 'Không tìm thấy danh mục.'),
    CATEGORY_NAME_OR_SLUG_CONFLICT: freezeDefinition(409, 'Tên hoặc đường dẫn danh mục đã tồn tại.'),
    SHIPPING_ADDRESS_REQUIRED: freezeDefinition(400, 'Vui lòng chọn địa chỉ nhận hàng.'),
});

export default ERROR_CONFIG;
