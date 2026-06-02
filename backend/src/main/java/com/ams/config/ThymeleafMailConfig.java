package com.ams.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.spring6.templateresolver.SpringResourceTemplateResolver;
import org.thymeleaf.templatemode.TemplateMode;

import java.nio.charset.StandardCharsets;

/**
 * Thymeleaf 邮件渲染配置
 *
 * <p>独立的 SpringTemplateEngine bean，仅用于邮件模板渲染，
 * 不干扰前端视图层（如果存在其他视图解析器）。</p>
 */
@Configuration
public class ThymeleafMailConfig {

    @Bean
    public SpringResourceTemplateResolver mailTemplateResolver() {
        SpringResourceTemplateResolver resolver = new SpringResourceTemplateResolver();
        resolver.setPrefix("classpath:/templates/mail/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resolver.setCacheable(true);
        resolver.setOrder(1);
        return resolver;
    }

    @Bean
    public SpringTemplateEngine mailTemplateEngine() {
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(mailTemplateResolver());
        engine.setEnableSpringELCompiler(false);
        return engine;
    }
}
