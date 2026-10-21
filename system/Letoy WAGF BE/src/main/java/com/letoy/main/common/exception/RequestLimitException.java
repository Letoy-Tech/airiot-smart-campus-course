package com.letoy.main.common.exception;

public class RequestLimitException extends RuntimeException{

    private static final long serialVersionUID = 1555967171104727461L;

    public RequestLimitException(){
        super("HTTP请求超出设定的限制");
    }

    public RequestLimitException(String message){
        super(message);
    }
}
